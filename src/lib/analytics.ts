/**
 * Analytics — Dashboard queries for StreamCPA
 *
 * Optimized Prisma queries for aggregating clicks, conversions,
 * earnings, and performance metrics across all dashboards.
 *
 * Uses raw SQL where Prisma's query builder falls short,
 * with Redis caching for expensive aggregations.
 */
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

// ==========================================
// TYPES
// ==========================================

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface EarningsPeriod {
  date: string;
  earnings: number;
  conversions: number;
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  spent: number;
  remaining: number;
}

export interface StreamerRanking {
  streamerId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  totalEarned: number;
  totalConversions: number;
  conversionRate: number;
}

export interface OverviewStats {
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  conversionRate: number;
  clicksTrend: number; // % change vs previous period
  conversionsTrend: number;
  earningsTrend: number;
}

// ==========================================
// HELPERS
// ==========================================

const CACHE_TTL = 300; // 5 minutes

async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached as string);
  } catch {
    // Redis down — skip cache
  }

  const result = await fn();

  try {
    await redis.setex(key, ttl, JSON.stringify(result));
  } catch {
    // Redis down — skip cache write
  }

  return result;
}

function getDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ==========================================
// CLICKS
// ==========================================

/**
 * Get daily click counts for a given filter
 */
export async function clicksByDay(
  filter: { streamerId?: string; campaignId?: string; days?: number },
): Promise<DailyMetric[]> {
  const { streamerId, campaignId, days = 30 } = filter;
  const since = getDaysAgo(days);

  const cacheKey = `analytics:clicks:${streamerId || campaignId || "all"}:${days}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const results = await db.$queryRaw<DailyMetric[]>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*)::int as count
      FROM "Click"
      WHERE "createdAt" >= ${since}
        ${streamerId ? db.$queryRaw`AND "streamerId" = ${streamerId}` : db.$queryRaw``}
        ${campaignId ? db.$queryRaw`AND "campaignId" = ${campaignId}` : db.$queryRaw``}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return results;
  });
}

// ==========================================
// CONVERSIONS
// ==========================================

/**
 * Get conversion rate for a given period
 */
export async function conversionRate(
  filter: { streamerId?: string; campaignId?: string; days?: number },
): Promise<{ rate: number; clicks: number; conversions: number }> {
  const { streamerId, campaignId, days = 30 } = filter;
  const since = getDaysAgo(days);

  const where: any = { createdAt: { gte: since } };
  if (streamerId) where.streamerId = streamerId;
  if (campaignId) where.campaignId = campaignId;

  const [clicks, conversions] = await Promise.all([
    db.click.count({ where }),
    db.conversion.count({
      where: {
        ...where,
        status: { in: ["APPROVED", "PENDING"] },
      },
    }),
  ]);

  return {
    rate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    clicks,
    conversions,
  };
}

// ==========================================
// EARNINGS
// ==========================================

/**
 * Get daily earnings for a streamer
 */
export async function earningsByPeriod(
  streamerId: string,
  days: number = 30,
): Promise<EarningsPeriod[]> {
  const since = getDaysAgo(days);
  const cacheKey = `analytics:earnings:${streamerId}:${days}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const results = await db.$queryRaw<EarningsPeriod[]>`
      SELECT
        DATE("createdAt") as date,
        COALESCE(SUM("payout"), 0)::float as earnings,
        COUNT(*)::int as conversions
      FROM "Conversion"
      WHERE "streamerId" = ${streamerId}
        AND "status" = 'APPROVED'
        AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return results;
  });
}

/**
 * Get total earnings summary for a streamer
 */
export async function earningsSummary(
  streamerId: string,
  days: number = 30,
): Promise<{ total: number; pending: number; paid: number; count: number }> {
  const since = getDaysAgo(days);

  const [approved, pending] = await Promise.all([
    db.conversion.aggregate({
      where: {
        streamerId,
        status: "APPROVED",
        createdAt: { gte: since },
      },
      _sum: { payout: true },
      _count: true,
    }),
    db.conversion.aggregate({
      where: {
        streamerId,
        status: "PENDING",
        createdAt: { gte: since },
      },
      _sum: { payout: true },
    }),
  ]);

  const paid = await db.payout.aggregate({
    where: {
      streamerId,
      status: "COMPLETED",
      processedAt: { gte: since },
    },
    _sum: { amount: true },
  });

  return {
    total: approved._sum.payout || 0,
    pending: pending._sum.payout || 0,
    paid: paid._sum.amount || 0,
    count: approved._count,
  };
}

// ==========================================
// CAMPAIGN PERFORMANCE
// ==========================================

/**
 * Get performance metrics for a brand's campaigns
 */
export async function campaignPerformance(
  brandId: string,
): Promise<CampaignPerformance[]> {
  const cacheKey = `analytics:campaigns:${brandId}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const campaigns = await db.campaign.findMany({
      where: { brandId },
      select: {
        id: true,
        name: true,
        spent: true,
        remainingBudget: true,
        _count: {
          select: {
            clicks: true,
            conversions: { where: { status: { in: ["APPROVED", "PENDING"] } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return campaigns.map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      clicks: c._count.clicks,
      conversions: c._count.conversions,
      conversionRate:
        c._count.clicks > 0
          ? (c._count.conversions / c._count.clicks) * 100
          : 0,
      spent: c.spent,
      remaining: c.remainingBudget,
    }));
  });
}

// ==========================================
// LEADERBOARDS
// ==========================================

/**
 * Get top streamers by earnings (for public leaderboard)
 */
export async function topStreamers(
  limit: number = 20,
  days: number = 30,
): Promise<StreamerRanking[]> {
  const cacheKey = `analytics:leaderboard:${limit}:${days}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const since = getDaysAgo(days);

    const streamers = await db.streamer.findMany({
      where: {
        status: "ACTIVE",
        conversions: {
          some: {
            status: "APPROVED",
            createdAt: { gte: since },
          },
        },
      },
      select: {
        id: true,
        twitchUsername: true,
        twitchDisplayName: true,
        twitchAvatar: true,
        totalEarned: true,
        _count: {
          select: {
            conversions: {
              where: {
                status: "APPROVED",
                createdAt: { gte: since },
              },
            },
            clicks: {
              where: { createdAt: { gte: since } },
            },
          },
        },
      },
      orderBy: { totalEarned: "desc" },
      take: limit,
    });

    return streamers.map((s) => ({
      streamerId: s.id,
      username: s.twitchUsername || "unknown",
      displayName: s.twitchDisplayName || "Unknown",
      avatar: s.twitchAvatar,
      totalEarned: s.totalEarned,
      totalConversions: s._count.conversions,
      conversionRate:
        s._count.clicks > 0
          ? (s._count.conversions / s._count.clicks) * 100
          : 0,
    }));
  });
}

// ==========================================
// OVERVIEW (Dashboard home)
// ==========================================

/**
 * Get overview stats with trend comparison
 */
export async function overviewStats(
  filter: { streamerId?: string; brandId?: string; days?: number },
): Promise<OverviewStats> {
  const { streamerId, brandId, days = 7 } = filter;
  const currentStart = getDaysAgo(days);
  const previousStart = getDaysAgo(days * 2);

  const clickWhere: any = {};
  const convWhere: any = { status: { in: ["APPROVED", "PENDING"] } };

  if (streamerId) {
    clickWhere.streamerId = streamerId;
    convWhere.streamerId = streamerId;
  }
  if (brandId) {
    clickWhere.campaign = { brandId };
    convWhere.campaign = { brandId };
  }

  // Current period
  const [curClicks, curConvs, curEarnings] = await Promise.all([
    db.click.count({ where: { ...clickWhere, createdAt: { gte: currentStart } } }),
    db.conversion.count({ where: { ...convWhere, createdAt: { gte: currentStart } } }),
    db.conversion.aggregate({
      where: { ...convWhere, createdAt: { gte: currentStart } },
      _sum: { payout: true },
    }),
  ]);

  // Previous period
  const [prevClicks, prevConvs, prevEarnings] = await Promise.all([
    db.click.count({
      where: { ...clickWhere, createdAt: { gte: previousStart, lt: currentStart } },
    }),
    db.conversion.count({
      where: { ...convWhere, createdAt: { gte: previousStart, lt: currentStart } },
    }),
    db.conversion.aggregate({
      where: { ...convWhere, createdAt: { gte: previousStart, lt: currentStart } },
      _sum: { payout: true },
    }),
  ]);

  const trend = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  return {
    totalClicks: curClicks,
    totalConversions: curConvs,
    totalEarnings: curEarnings._sum.payout || 0,
    conversionRate: curClicks > 0 ? (curConvs / curClicks) * 100 : 0,
    clicksTrend: trend(curClicks, prevClicks),
    conversionsTrend: trend(curConvs, prevConvs),
    earningsTrend: trend(
      curEarnings._sum.payout || 0,
      prevEarnings._sum.payout || 0,
    ),
  };
}
