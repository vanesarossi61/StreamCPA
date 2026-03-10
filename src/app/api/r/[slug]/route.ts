/**
 * Click Tracking — GET /api/r/[slug]
 *
 * When a viewer clicks a streamer's affiliate link:
 * 1. Look up the affiliate link by slug
 * 2. Rate limit by IP
 * 3. Run fraud analysis on the click
 * 4. Record click in database
 * 5. Update real-time counters in Redis
 * 6. Redirect to the campaign's landing URL
 *
 * This is the highest-traffic endpoint. Optimized for speed:
 * - Fraud analysis runs in parallel with DB writes
 * - Redis counters update asynchronously
 * - 302 redirect happens ASAP
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit } from "@/lib/rate-limit";
import { analyzeClick } from "@/lib/fraud";
import { incrementCounter } from "@/lib/redis";
import { createHash, randomUUID } from "crypto";

// ==========================================
// GEO DETECTION
// ==========================================

function getCountryFromHeaders(req: NextRequest): string | null {
  return (
    req.headers.get("cf-ipcountry") || // Cloudflare
    req.headers.get("x-vercel-ip-country") || // Vercel
    null
  );
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.ip ||
    "unknown"
  );
}

function getDeviceType(ua: string): string {
  const lower = ua.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(lower)) {
    return /ipad|tablet/.test(lower) ? "tablet" : "mobile";
  }
  return "desktop";
}

// ==========================================
// ROUTE HANDLER
// ==========================================

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const { slug } = params;

  // 1. Rate limit
  const rateLimited = await applyRateLimit(req);
  if (rateLimited) return rateLimited;

  // 2. Find affiliate link
  const link = await db.affiliateLink.findUnique({
    where: { slug },
    include: {
      campaign: {
        select: {
          id: true,
          status: true,
          landingUrl: true,
          remainingBudget: true,
          conversionType: true,
        },
      },
      streamer: {
        select: { id: true },
      },
    },
  });

  // Not found or inactive -> redirect to homepage
  if (!link || !link.isActive) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Campaign not active -> redirect to homepage
  if (link.campaign.status !== "ACTIVE") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // 3. Collect click metadata
  const ip = getClientIp(req);
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const userAgent = req.headers.get("user-agent") || null;
  const referer = req.headers.get("referer") || null;
  const country = getCountryFromHeaders(req);
  const device = userAgent ? getDeviceType(userAgent) : null;
  const clickId = randomUUID();

  // 4. Run fraud analysis (non-blocking for redirect speed)
  const fraudPromise = analyzeClick({
    ipHash,
    userAgent,
    affiliateLinkId: link.id,
    streamerId: link.streamer.id,
    campaignId: link.campaign.id,
    country,
    referer,
  });

  // 5. Build redirect URL with click tracking parameter
  const targetUrl = new URL(link.campaign.landingUrl);
  targetUrl.searchParams.set("scp_click", clickId);

  // 6. Wait for fraud analysis, then record click
  // (we await here to ensure the click is recorded, but we could
  //  fire-and-forget for even faster redirects)
  try {
    const fraudResult = await fraudPromise;

    // If blocked by fraud system, don't record and redirect to homepage
    if (fraudResult.blocked) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Record click in DB and update counters in parallel
    await Promise.all([
      // DB insert
      db.click.create({
        data: {
          affiliateLinkId: link.id,
          campaignId: link.campaign.id,
          streamerId: link.streamer.id,
          clickId,
          ipHash,
          country,
          device,
          userAgent,
          referer,
          flagged: fraudResult.recommendation !== "approve",
          fraudScore: fraudResult.totalScore,
          flagReason:
            fraudResult.signals.length > 0
              ? fraudResult.signals.map((s) => s.rule).join(", ")
              : null,
        },
      }),
      // Update affiliate link click counter
      db.affiliateLink.update({
        where: { id: link.id },
        data: { totalClicks: { increment: 1 } },
      }),
      // Redis real-time counters
      incrementCounter("clicks", `campaign:${link.campaign.id}`),
      incrementCounter("clicks", `streamer:${link.streamer.id}`),
      incrementCounter("clicks", `link:${link.id}`),
    ]);
  } catch (error) {
    // Don't block redirect on errors — log and continue
    console.error("[click-tracking] Error recording click:", error);
  }

  // 7. Redirect to campaign landing page
  return NextResponse.redirect(targetUrl.toString(), 302);
}
