/**
 * Affiliate link redirect endpoint (Edge-optimized)
 * GET /r/[slug] → records click → redirects to campaign landing page
 * 
 * This is the core tracking endpoint. Every affiliate link resolves here.
 * Example: streamcpa.io/r/xK9mQ3pL → records click → redirects to brand's landing page
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateClickId, hashIP, parseDevice, calculateFraudScore } from "@/lib/tracking";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;

  try {
    // Look up the affiliate link
    const affiliateLink = await db.affiliateLink.findUnique({
      where: { slug },
      include: {
        campaign: { select: { id: true, status: true, landingUrl: true, attributionWindow: true } },
      },
    });

    if (!affiliateLink || !affiliateLink.isActive) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (affiliateLink.campaign.status !== "ACTIVE") {
      // Campaign not active, redirect to landing anyway but don't track
      return NextResponse.redirect(affiliateLink.campaign.landingUrl);
    }

    // Extract tracking data
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "0.0.0.0";
    const ipHash = hashIP(ip);
    const userAgent = req.headers.get("user-agent");
    const referer = req.headers.get("referer");
    const { device, browser, os } = parseDevice(userAgent);

    // Geo lookup from Vercel headers (free on Vercel Edge)
    const country = req.headers.get("x-vercel-ip-country") || req.geo?.country || null;
    const region = req.headers.get("x-vercel-ip-country-region") || req.geo?.region || null;

    // Generate unique click ID
    const clickId = generateClickId();

    // Check uniqueness (same IP + same link in last 24h)
    const recentClick = await db.click.findFirst({
      where: {
        ipHash,
        affiliateLinkId: affiliateLink.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    const isUnique = !recentClick;

    // Calculate fraud score
    const { score: fraudScore, reasons } = await calculateFraudScore({
      ipHash,
      affiliateLinkId: affiliateLink.id,
      streamerId: affiliateLink.streamerId,
      campaignId: affiliateLink.campaignId,
      country,
    });

    // Record click (fire-and-forget for speed, but we await to ensure data integrity)
    await db.click.create({
      data: {
        clickId,
        affiliateLinkId: affiliateLink.id,
        campaignId: affiliateLink.campaignId,
        streamerId: affiliateLink.streamerId,
        ipHash,
        country,
        region,
        userAgent,
        device,
        browser,
        os,
        referer,
        isUnique,
        fraudScore,
        flagged: fraudScore >= 50,
        flagReason: reasons.length > 0 ? reasons.join("; ") : null,
      },
    });

    // Update counters
    await db.$transaction([
      db.affiliateLink.update({
        where: { id: affiliateLink.id },
        data: { totalClicks: { increment: 1 } },
      }),
      db.campaign.update({
        where: { id: affiliateLink.campaignId },
        data: { totalClicks: { increment: 1 } },
      }),
    ]);

    // Build redirect URL with click ID for attribution
    const redirectUrl = new URL(affiliateLink.campaign.landingUrl);
    redirectUrl.searchParams.set("cid", clickId);
    redirectUrl.searchParams.set("ref", "streamcpa");

    // Redirect with 302 (temporary) to allow tracking future clicks
    return NextResponse.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    console.error("Click tracking error:", error);
    // On error, still redirect to avoid dead links
    return NextResponse.redirect(new URL("/", req.url));
  }
}
