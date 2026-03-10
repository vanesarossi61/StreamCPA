/**
 * Tracking utilities — link generation, click processing, anti-fraud
 */
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { db } from "@/lib/db";

/**
 * Generate a unique affiliate link slug (8 characters)
 */
export function generateLinkSlug(): string {
  return nanoid(8);
}

/**
 * Generate a unique click ID for postback attribution
 */
export function generateClickId(): string {
  return nanoid(16);
}

/**
 * Hash an IP address for privacy-compliant storage
 */
export function hashIP(ip: string): string {
  return createHash("sha256").update(ip + process.env.NEXTAUTH_SECRET).digest("hex").slice(0, 32);
}

/**
 * Parse User-Agent to detect device type
 */
export function parseDevice(ua: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: "unknown", browser: "unknown", os: "unknown" };

  const uaLower = ua.toLowerCase();

  // Device
  let device = "desktop";
  if (/mobile|android|iphone|ipad/.test(uaLower)) {
    device = /ipad|tablet/.test(uaLower) ? "tablet" : "mobile";
  }

  // Browser
  let browser = "other";
  if (uaLower.includes("chrome") && !uaLower.includes("edg")) browser = "chrome";
  else if (uaLower.includes("firefox")) browser = "firefox";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "safari";
  else if (uaLower.includes("edg")) browser = "edge";

  // OS
  let os = "other";
  if (uaLower.includes("windows")) os = "windows";
  else if (uaLower.includes("mac")) os = "macos";
  else if (uaLower.includes("linux")) os = "linux";
  else if (uaLower.includes("android")) os = "android";
  else if (uaLower.includes("iphone") || uaLower.includes("ipad")) os = "ios";

  return { device, browser, os };
}

/**
 * Anti-fraud scoring system
 * Returns a score from 0 (clean) to 100 (definite fraud)
 */
export async function calculateFraudScore(params: {
  ipHash: string;
  affiliateLinkId: string;
  streamerId: string;
  campaignId: string;
  country: string | null;
}): Promise<{ score: number; reasons: string[] }> {
  const { ipHash, affiliateLinkId, streamerId, campaignId, country } = params;
  let score = 0;
  const reasons: string[] = [];

  // Rule 1: Duplicate IP on same link in last 24h
  const duplicateClicks = await db.click.count({
    where: {
      ipHash,
      affiliateLinkId,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (duplicateClicks > 0) {
    score += 30;
    reasons.push(`Duplicate IP: ${duplicateClicks} clicks from same IP in 24h`);
  }

  // Rule 2: Click velocity — too many clicks from same IP across all links in 1 hour
  const velocityClicks = await db.click.count({
    where: {
      ipHash,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (velocityClicks > 10) {
    score += 25;
    reasons.push(`High velocity: ${velocityClicks} clicks from same IP in 1h`);
  }

  // Rule 3: Geo mismatch — streamer's country vs. click country
  if (country) {
    const streamer = await db.streamer.findUnique({
      where: { id: streamerId },
      select: { country: true },
    });
    // Not a hard fraud signal, but suspicious if mismatch is extreme
    // Only flag if streamer has a country set and they're completely different regions
  }

  // Rule 4: Self-referral detection — check if click IP matches recent streamer IPs
  // (simplified: check if this IP has clicked on many different streamers' links)
  const differentStreamersClicked = await db.click.groupBy({
    by: ["streamerId"],
    where: {
      ipHash,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (differentStreamersClicked.length > 5) {
    score += 20;
    reasons.push(`Suspicious: IP clicked links from ${differentStreamersClicked.length} different streamers`);
  }

  // Rule 5: Campaign budget exceeded (soft signal)
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { remainingBudget: true, totalBudget: true },
  });
  if (campaign && campaign.remainingBudget <= 0) {
    score += 15;
    reasons.push("Campaign budget exhausted");
  }

  return { score: Math.min(score, 100), reasons };
}

/**
 * Process a conversion — validate, calculate payouts, update counters
 */
export async function processConversion(params: {
  clickId: string;
  externalId?: string;
  payoutOverride?: number;
}): Promise<{ success: boolean; conversionId?: string; error?: string }> {
  const { clickId, externalId, payoutOverride } = params;

  // Find the click
  const click = await db.click.findUnique({
    where: { clickId },
    include: {
      affiliateLink: true,
      campaign: true,
    },
  });

  if (!click) {
    return { success: false, error: "Click not found" };
  }

  // Check if conversion already exists for this click
  const existingConversion = await db.conversion.findUnique({
    where: { clickId: click.id },
  });

  if (existingConversion) {
    return { success: false, error: "Conversion already recorded for this click" };
  }

  // Check attribution window
  const clickAge = Date.now() - click.createdAt.getTime();
  const windowMs = click.campaign.attributionWindow * 24 * 60 * 60 * 1000;
  if (clickAge > windowMs) {
    return { success: false, error: "Click outside attribution window" };
  }

  // Check campaign is still active
  if (click.campaign.status !== "ACTIVE") {
    return { success: false, error: "Campaign is no longer active" };
  }

  // Check remaining budget
  const payout = payoutOverride || click.campaign.payoutPerConversion;
  const platformFee = payout * click.campaign.platformFee;
  const totalAmount = payout + platformFee;

  if (click.campaign.remainingBudget < totalAmount) {
    return { success: false, error: "Campaign budget exhausted" };
  }

  // Determine initial status based on fraud score
  let status: "PENDING" | "APPROVED" | "UNDER_REVIEW" = "PENDING";
  if (click.fraudScore >= 70) {
    status = "UNDER_REVIEW";
  } else if (click.fraudScore < 30) {
    status = "APPROVED";
  }

  // Create conversion and update counters in a transaction
  const conversion = await db.$transaction(async (tx) => {
    // Create conversion
    const conv = await tx.conversion.create({
      data: {
        clickId: click.id,
        affiliateLinkId: click.affiliateLinkId,
        campaignId: click.campaignId,
        streamerId: click.streamerId,
        conversionType: click.campaign.conversionType,
        payout,
        platformFee,
        totalAmount,
        status,
        fraudScore: click.fraudScore,
        externalId,
      },
    });

    // Update affiliate link counters
    await tx.affiliateLink.update({
      where: { id: click.affiliateLinkId },
      data: {
        totalConversions: { increment: 1 },
        totalEarnings: status === "APPROVED" ? { increment: payout } : undefined,
      },
    });

    // Update campaign counters
    await tx.campaign.update({
      where: { id: click.campaignId },
      data: {
        totalConversions: { increment: 1 },
        spent: status === "APPROVED" ? { increment: totalAmount } : undefined,
        remainingBudget: status === "APPROVED" ? { decrement: totalAmount } : undefined,
      },
    });

    // If approved, update streamer balance
    if (status === "APPROVED") {
      await tx.streamer.update({
        where: { id: click.streamerId },
        data: {
          balancePending: { increment: payout },
          totalEarned: { increment: payout },
        },
      });
    }

    return conv;
  });

  return { success: true, conversionId: conversion.id };
}
