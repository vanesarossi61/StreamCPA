/**
 * Advanced Fraud Detection Engine
 *
 * Separates fraud logic from tracking.ts for maintainability.
 * Implements multi-signal scoring with configurable rules and
 * Redis-backed velocity checks for real-time detection.
 */
import { db } from "@/lib/db";
import { redis, getCounter, incrementCounter } from "@/lib/redis";

// ==========================================
// TYPES
// ==========================================

export interface FraudSignal {
  rule: string;
  score: number;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface FraudAnalysis {
  totalScore: number;
  signals: FraudSignal[];
  recommendation: "approve" | "review" | "reject";
  blocked: boolean;
}

interface ClickFraudParams {
  ipHash: string;
  userAgent: string | null;
  affiliateLinkId: string;
  streamerId: string;
  campaignId: string;
  country: string | null;
  referer: string | null;
}

interface ConversionFraudParams {
  clickId: string;
  clickFraudScore: number;
  timeSinceClickMs: number;
  conversionValue: number;
  campaignId: string;
  streamerId: string;
  ipHash: string;
}

// ==========================================
// CONFIGURATION
// ==========================================

const THRESHOLDS = {
  /** Score above which we auto-reject */
  REJECT: 80,
  /** Score above which we flag for manual review */
  REVIEW: 40,
  /** Score below which we auto-approve */
  APPROVE: 40,
  /** Block click entirely (don't even record it) */
  BLOCK: 95,
} as const;

const WINDOWS = {
  /** 1 hour in ms */
  ONE_HOUR: 60 * 60 * 1000,
  /** 24 hours in ms */
  ONE_DAY: 24 * 60 * 60 * 1000,
  /** 1 minute in ms */
  ONE_MINUTE: 60 * 1000,
} as const;

// ==========================================
// CLICK FRAUD ANALYSIS
// ==========================================

/**
 * Analyze a click for fraud signals.
 * Called during click processing in /r/[slug] route.
 */
export async function analyzeClick(params: ClickFraudParams): Promise<FraudAnalysis> {
  const signals: FraudSignal[] = [];

  // Run all checks in parallel for speed
  const [
    duplicateResult,
    velocityResult,
    botResult,
    selfReferralResult,
    geoResult,
    budgetResult,
  ] = await Promise.all([
    checkDuplicateIP(params),
    checkClickVelocity(params),
    checkBotSignals(params),
    checkSelfReferral(params),
    checkGeoAnomaly(params),
    checkBudgetExhausted(params),
  ]);

  signals.push(
    ...duplicateResult,
    ...velocityResult,
    ...botResult,
    ...selfReferralResult,
    ...geoResult,
    ...budgetResult,
  );

  const totalScore = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.score, 0),
  );

  // Track this click in Redis for velocity checks
  await trackClickInRedis(params);

  return {
    totalScore,
    signals,
    recommendation:
      totalScore >= THRESHOLDS.REJECT
        ? "reject"
        : totalScore >= THRESHOLDS.REVIEW
          ? "review"
          : "approve",
    blocked: totalScore >= THRESHOLDS.BLOCK,
  };
}

// ==========================================
// CONVERSION FRAUD ANALYSIS
// ==========================================

/**
 * Analyze a conversion for fraud signals.
 * Called during postback processing.
 */
export async function analyzeConversion(
  params: ConversionFraudParams,
): Promise<FraudAnalysis> {
  const signals: FraudSignal[] = [];

  // Inherit click fraud score
  if (params.clickFraudScore >= 30) {
    signals.push({
      rule: "inherited_click_fraud",
      score: Math.round(params.clickFraudScore * 0.5),
      description: `Original click had fraud score of ${params.clickFraudScore}`,
      severity: params.clickFraudScore >= 60 ? "high" : "medium",
    });
  }

  // Suspiciously fast conversion (< 10 seconds)
  if (params.timeSinceClickMs < 10_000) {
    signals.push({
      rule: "instant_conversion",
      score: 35,
      description: `Conversion happened ${Math.round(params.timeSinceClickMs / 1000)}s after click`,
      severity: "high",
    });
  }

  // Check conversion velocity per streamer
  const recentConversions = await db.conversion.count({
    where: {
      streamerId: params.streamerId,
      campaignId: params.campaignId,
      createdAt: { gte: new Date(Date.now() - WINDOWS.ONE_HOUR) },
    },
  });

  if (recentConversions > 20) {
    signals.push({
      rule: "conversion_velocity",
      score: 30,
      description: `${recentConversions} conversions from same streamer in 1h`,
      severity: "high",
    });
  }

  // Check for duplicate conversions from same IP
  const sameIpConversions = await db.conversion.count({
    where: {
      campaignId: params.campaignId,
      click: { ipHash: params.ipHash },
      createdAt: { gte: new Date(Date.now() - WINDOWS.ONE_DAY) },
    },
  });

  if (sameIpConversions > 3) {
    signals.push({
      rule: "duplicate_ip_conversion",
      score: 25,
      description: `${sameIpConversions} conversions from same IP in 24h`,
      severity: "medium",
    });
  }

  const totalScore = Math.min(
    100,
    signals.reduce((sum, s) => sum + s.score, 0),
  );

  return {
    totalScore,
    signals,
    recommendation:
      totalScore >= THRESHOLDS.REJECT
        ? "reject"
        : totalScore >= THRESHOLDS.REVIEW
          ? "review"
          : "approve",
    blocked: false, // We never block conversions, just flag them
  };
}

// ==========================================
// INDIVIDUAL FRAUD CHECKS
// ==========================================

/** Rule 1: Duplicate IP on same link in 24h */
async function checkDuplicateIP(params: ClickFraudParams): Promise<FraudSignal[]> {
  const count = await db.click.count({
    where: {
      ipHash: params.ipHash,
      affiliateLinkId: params.affiliateLinkId,
      createdAt: { gte: new Date(Date.now() - WINDOWS.ONE_DAY) },
    },
  });

  if (count === 0) return [];

  if (count >= 5) {
    return [{
      rule: "duplicate_ip_heavy",
      score: 40,
      description: `${count} clicks from same IP on same link in 24h`,
      severity: "critical",
    }];
  }

  return [{
    rule: "duplicate_ip",
    score: 15 + count * 5,
    description: `${count} clicks from same IP on same link in 24h`,
    severity: count >= 3 ? "high" : "medium",
  }];
}

/** Rule 2: Click velocity — too many clicks from same IP across all links */
async function checkClickVelocity(params: ClickFraudParams): Promise<FraudSignal[]> {
  // Use Redis counter for real-time velocity (faster than DB)
  const key = `velocity:${params.ipHash}`;
  const count = await getCounter("fraud", key);

  if (count > 50) {
    return [{
      rule: "extreme_velocity",
      score: 45,
      description: `${count} total clicks from IP in tracking window`,
      severity: "critical",
    }];
  }

  if (count > 15) {
    return [{
      rule: "high_velocity",
      score: 25,
      description: `${count} total clicks from IP in tracking window`,
      severity: "high",
    }];
  }

  return [];
}

/** Rule 3: Bot detection via User-Agent analysis */
async function checkBotSignals(params: ClickFraudParams): Promise<FraudSignal[]> {
  const signals: FraudSignal[] = [];
  const ua = (params.userAgent || "").toLowerCase();

  // No User-Agent at all
  if (!params.userAgent || params.userAgent.length < 10) {
    signals.push({
      rule: "missing_ua",
      score: 20,
      description: "Missing or suspiciously short User-Agent",
      severity: "medium",
    });
    return signals;
  }

  // Known bot patterns
  const botPatterns = [
    "bot", "crawler", "spider", "scraper", "headless",
    "phantom", "selenium", "puppeteer", "playwright",
    "curl", "wget", "python-requests", "axios", "node-fetch",
    "go-http-client", "java/", "okhttp",
  ];

  const isBot = botPatterns.some((pattern) => ua.includes(pattern));
  if (isBot) {
    signals.push({
      rule: "bot_ua",
      score: 50,
      description: "User-Agent matches known bot pattern",
      severity: "critical",
    });
  }

  // No referer on a click (suspicious but not definitive)
  if (!params.referer) {
    signals.push({
      rule: "no_referer",
      score: 5,
      description: "No Referer header (direct navigation or stripped)",
      severity: "low",
    });
  }

  return signals;
}

/** Rule 4: Self-referral — IP clicking on too many different streamers' links */
async function checkSelfReferral(params: ClickFraudParams): Promise<FraudSignal[]> {
  const distinctStreamers = await db.click.groupBy({
    by: ["streamerId"],
    where: {
      ipHash: params.ipHash,
      createdAt: { gte: new Date(Date.now() - WINDOWS.ONE_DAY) },
    },
  });

  if (distinctStreamers.length > 10) {
    return [{
      rule: "click_farm",
      score: 35,
      description: `IP clicked links from ${distinctStreamers.length} different streamers in 24h`,
      severity: "critical",
    }];
  }

  if (distinctStreamers.length > 5) {
    return [{
      rule: "multi_streamer_ip",
      score: 20,
      description: `IP clicked links from ${distinctStreamers.length} different streamers in 24h`,
      severity: "medium",
    }];
  }

  return [];
}

/**
 * Rule 5: Geographic anomaly -- click from unexpected country
 *
 * Three-layer geo verification:
 *   A) Click country vs campaign target countries
 *   B) Click country vs streamer registered country (fraud indicator)
 *   C) Historical pattern: majority of recent clicks from foreign country
 */
async function checkGeoAnomaly(params: ClickFraudParams): Promise<FraudSignal[]> {
  if (!params.country) return [];

  const signals: FraudSignal[] = [];

  // Fetch campaign + streamer data in parallel
  const [campaign, streamer] = await Promise.all([
    db.campaign.findUnique({
      where: { id: params.campaignId },
      select: { countries: true },
    }),
    db.streamer.findUnique({
      where: { id: params.streamerId },
      select: { country: true },
    }),
  ]);

  // --- Layer A: Click country vs campaign target countries ---
  if (campaign && campaign.countries.length > 0) {
    const isTargeted = campaign.countries.includes(params.country);
    if (!isTargeted) {
      signals.push({
        rule: "geo_campaign_mismatch",
        score: 15,
        description: `Click from ${params.country}, campaign targets: ${campaign.countries.join(", ")}`,
        severity: "medium",
      });
    }
  }

  // --- Layer B: Click country vs streamer registered country ---
  // If the streamer registered from Argentina but clicks come from Russia,
  // that is a strong fraud indicator (self-click farms, VPN traffic, etc.)
  if (streamer?.country && streamer.country !== params.country) {
    signals.push({
      rule: "geo_streamer_mismatch",
      score: 25,
      description: `Click from ${params.country}, streamer registered in ${streamer.country}`,
      severity: "high",
    });
  }

  // --- Layer C: Historical pattern analysis ---
  // If >60% of this streamer's recent clicks on this campaign come from
  // a country that does NOT match the streamer's country, flag the pattern.
  if (streamer?.country) {
    const windowStart = new Date(Date.now() - WINDOWS.ONE_DAY);
    const [totalRecent, foreignRecent] = await Promise.all([
      db.click.count({
        where: {
          streamerId: params.streamerId,
          campaignId: params.campaignId,
          createdAt: { gte: windowStart },
        },
      }),
      db.click.count({
        where: {
          streamerId: params.streamerId,
          campaignId: params.campaignId,
          createdAt: { gte: windowStart },
          NOT: { country: streamer.country },
        },
      }),
    ]);

    // Need a meaningful sample size (at least 10 clicks) to avoid false positives
    if (totalRecent >= 10) {
      const foreignRatio = foreignRecent / totalRecent;
      if (foreignRatio > 0.6) {
        signals.push({
          rule: "geo_pattern_anomaly",
          score: 35,
          description: `${Math.round(foreignRatio * 100)}% of ${totalRecent} recent clicks are from outside streamer country (${streamer.country})`,
          severity: "critical",
        });
      }
    }
  }

  return signals;
}

/** Rule 6: Campaign budget already exhausted */
async function checkBudgetExhausted(params: ClickFraudParams): Promise<FraudSignal[]> {
  const campaign = await db.campaign.findUnique({
    where: { id: params.campaignId },
    select: { remainingBudget: true, status: true },
  });

  if (!campaign) return [];

  if (campaign.remainingBudget <= 0 || campaign.status !== "ACTIVE") {
    return [{
      rule: "budget_exhausted",
      score: 10,
      description: "Campaign budget exhausted or campaign inactive",
      severity: "low",
    }];
  }

  return [];
}

// ==========================================
// REDIS TRACKING HELPERS
// ==========================================

/** Track click in Redis for real-time velocity checks */
async function trackClickInRedis(params: ClickFraudParams): Promise<void> {
  const key = `velocity:${params.ipHash}`;
  await incrementCounter("fraud", key);
}

// ==========================================
// ADMIN UTILITIES
// ==========================================

/**
 * Get fraud summary for admin dashboard
 */
export async function getFraudSummary() {
  const [highRiskClicks, underReviewConversions, blockedToday] = await Promise.all([
    db.click.count({
      where: {
        fraudScore: { gte: THRESHOLDS.REVIEW },
        createdAt: { gte: new Date(Date.now() - WINDOWS.ONE_DAY) },
      },
    }),
    db.conversion.count({
      where: { status: "UNDER_REVIEW" },
    }),
    db.click.count({
      where: {
        fraudScore: { gte: THRESHOLDS.BLOCK },
        createdAt: { gte: new Date(Date.now() - WINDOWS.ONE_DAY) },
      },
    }),
  ]);

  return {
    highRiskClicks,
    underReviewConversions,
    blockedToday,
    thresholds: THRESHOLDS,
  };
}

/**
 * Re-analyze a specific conversion (admin action)
 */
export async function reanalyzeConversion(conversionId: string): Promise<FraudAnalysis> {
  const conversion = await db.conversion.findUnique({
    where: { id: conversionId },
    include: {
      click: true,
    },
  });

  if (!conversion || !conversion.click) {
    throw new Error("Conversion or associated click not found");
  }

  return analyzeConversion({
    clickId: conversion.click.clickId,
    clickFraudScore: conversion.click.fraudScore,
    timeSinceClickMs:
      conversion.createdAt.getTime() - conversion.click.createdAt.getTime(),
    conversionValue: conversion.payout,
    campaignId: conversion.campaignId,
    streamerId: conversion.streamerId,
    ipHash: conversion.click.ipHash,
  });
}
