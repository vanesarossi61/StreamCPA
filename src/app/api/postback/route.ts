/**
 * Conversion Postback — POST /api/postback
 *
 * External networks call this endpoint when a conversion happens.
 * The click ID links back to our click record for attribution.
 *
 * Flow:
 * 1. Validate signature (HMAC-SHA256 with shared secret)
 * 2. Rate limit by IP
 * 3. Find the original click
 * 4. Create conversion record
 * 5. Send to Inngest for async fraud analysis
 *
 * Query params format (industry standard):
 *   POST /api/postback?click_id=xxx&payout=5.00&event=signup&txn_id=abc123
 *
 * Or JSON body:
 *   { "click_id": "xxx", "payout": 5.00, "event": "signup", "txn_id": "abc123" }
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest";
import { applyRateLimit } from "@/lib/rate-limit";
import { createHmac, createHash } from "crypto";

// ==========================================
// HELPERS
// ==========================================

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.ip ||
    "unknown"
  );
}

/**
 * Validate HMAC signature for postback authenticity.
 * Signature = HMAC-SHA256(click_id + payout + event, POSTBACK_SECRET)
 */
function validateSignature(
  clickId: string,
  payout: string,
  event: string,
  signature: string,
): boolean {
  const secret = process.env.POSTBACK_SECRET;
  if (!secret) {
    console.warn("[postback] POSTBACK_SECRET not set — skipping validation");
    return true; // Allow in development
  }

  const payload = `${clickId}${payout}${event}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return expected === signature;
}

// ==========================================
// ROUTE HANDLER
// ==========================================

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const rateLimited = await applyRateLimit(req);
  if (rateLimited) return rateLimited;

  try {
    // 2. Parse parameters (support both query params and JSON body)
    let clickId: string;
    let payout: number;
    let event: string;
    let txnId: string | null = null;
    let signature: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      clickId = body.click_id || body.clickId;
      payout = parseFloat(body.payout || body.amount || "0");
      event = body.event || body.type || "conversion";
      txnId = body.txn_id || body.transactionId || null;
      signature = body.signature || body.sig || null;
    } else {
      const params = req.nextUrl.searchParams;
      clickId = params.get("click_id") || params.get("clickId") || "";
      payout = parseFloat(params.get("payout") || params.get("amount") || "0");
      event = params.get("event") || params.get("type") || "conversion";
      txnId = params.get("txn_id") || params.get("transactionId") || null;
      signature = params.get("signature") || params.get("sig") || null;
    }

    // 3. Validate required fields
    if (!clickId) {
      return NextResponse.json(
        { error: "Missing click_id parameter" },
        { status: 400 },
      );
    }

    if (isNaN(payout) || payout <= 0) {
      return NextResponse.json(
        { error: "Invalid payout amount" },
        { status: 400 },
      );
    }

    // 4. Validate signature (if provided or required)
    if (signature && !validateSignature(clickId, String(payout), event, signature)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403 },
      );
    }

    // 5. Find the original click
    const click = await db.click.findUnique({
      where: { clickId },
      include: {
        affiliateLink: {
          select: { id: true, campaignId: true, streamerId: true },
        },
        campaign: {
          select: {
            id: true,
            status: true,
            maxPayout: true,
            remainingBudget: true,
            platformFeePercent: true,
          },
        },
      },
    });

    if (!click) {
      return NextResponse.json(
        { error: "Click not found", click_id: clickId },
        { status: 404 },
      );
    }

    // 6. Validate campaign is still active
    if (click.campaign.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Campaign is no longer active" },
        { status: 410 },
      );
    }

    // 7. Check for duplicate conversion (same click + txn)
    if (txnId) {
      const existing = await db.conversion.findFirst({
        where: { externalTxnId: txnId },
      });
      if (existing) {
        return NextResponse.json(
          { ok: true, duplicate: true, conversion_id: existing.id },
          { status: 200 },
        );
      }
    }

    // 8. Cap payout at campaign max
    const effectivePayout = Math.min(payout, click.campaign.maxPayout || payout);

    // 9. Calculate platform fee
    const feePercent = click.campaign.platformFeePercent || 20;
    const platformFee = Number(((effectivePayout * feePercent) / 100).toFixed(2));

    // 10. Check campaign budget
    const totalCost = effectivePayout + platformFee;
    if (click.campaign.remainingBudget < totalCost) {
      return NextResponse.json(
        { error: "Campaign budget exhausted" },
        { status: 402 },
      );
    }

    // 11. Create conversion record
    const ip = getClientIp(req);
    const ipHash = createHash("sha256").update(ip).digest("hex");

    const conversion = await db.conversion.create({
      data: {
        clickId: click.id,
        campaignId: click.campaign.id,
        streamerId: click.affiliateLink.streamerId,
        affiliateLinkId: click.affiliateLink.id,
        event,
        payout: effectivePayout,
        platformFee,
        status: "PENDING",
        ipHash,
        externalTxnId: txnId,
      },
    });

    // 12. Send to Inngest for async fraud analysis + balance updates
    await inngest.send({
      name: "conversion/received",
      data: {
        conversionId: conversion.id,
        clickId: click.clickId,
        campaignId: click.campaign.id,
        streamerId: click.affiliateLink.streamerId,
        affiliateLinkId: click.affiliateLink.id,
        payout: effectivePayout,
        ipHash,
      },
    });

    // 13. Return success
    return NextResponse.json(
      {
        ok: true,
        conversion_id: conversion.id,
        payout: effectivePayout,
        status: "pending_review",
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("[postback] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Also support GET for simple integrations
export async function GET(req: NextRequest) {
  return POST(req);
}
