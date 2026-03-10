/**
 * Inngest — Background job processing for StreamCPA
 *
 * Handles async operations that shouldn't block the request:
 *   - Conversion processing (fraud check + approval)
 *   - Payout calculations (batch + individual)
 *   - Fraud detection (deep analysis)
 *   - Notifications (in-app + email)
 *   - Twitch sync (profile updates)
 *
 * Uses Inngest for serverless-compatible, reliable job execution
 * with automatic retries, concurrency control, and observability.
 */
import { Inngest, EventSchemas } from "inngest";
import { db } from "@/lib/db";
import { analyzeConversion } from "@/lib/fraud";
import { sendEmail, emailTemplates } from "@/lib/email";
import { acquireLock } from "@/lib/redis";

// ==========================================
// EVENT TYPES
// ==========================================

type Events = {
  "conversion/received": {
    data: {
      conversionId: string;
      clickId: string;
      campaignId: string;
      streamerId: string;
      affiliateLinkId: string;
      payout: number;
      ipHash: string;
    };
  };
  "payout/calculate": {
    data: {
      streamerId: string;
      periodStart: string; // ISO date
      periodEnd: string;
    };
  };
  "payout/batch-calculate": {
    data: {
      periodStart: string;
      periodEnd: string;
    };
  };
  "payout/process": {
    data: {
      payoutId: string;
    };
  };
  "notification/send": {
    data: {
      userId: string;
      type: string;
      title: string;
      message: string;
      link?: string;
      sendEmail?: boolean;
    };
  };
  "twitch/sync-profile": {
    data: {
      streamerId: string;
      twitchId: string;
    };
  };
  "campaign/status-changed": {
    data: {
      campaignId: string;
      oldStatus: string;
      newStatus: string;
    };
  };
};

// ==========================================
// CLIENT
// ==========================================

export const inngest = new Inngest({
  id: "streamcpa",
  schemas: new EventSchemas().fromRecord<Events>(),
});

// ==========================================
// FUNCTION: Process Conversion
// ==========================================

/**
 * When a postback comes in, we:
 * 1. Run fraud analysis on the conversion
 * 2. Auto-approve if score < 40, flag for review if 40-80, auto-reject if > 80
 * 3. If approved, update streamer balances + campaign spend
 * 4. Send notifications to streamer (and brand if flagged)
 */
export const processConversion = inngest.createFunction(
  {
    id: "process-conversion",
    concurrency: { limit: 10 },
    retries: 3,
  },
  { event: "conversion/received" },
  async ({ event, step }) => {
    const { conversionId, clickId, campaignId, streamerId, payout, ipHash } =
      event.data;

    // Step 1: Run fraud analysis
    const fraudResult = await step.run("analyze-fraud", async () => {
      const click = await db.click.findUnique({
        where: { clickId },
      });

      if (!click) throw new Error(`Click ${clickId} not found`);

      return analyzeConversion({
        clickId,
        clickFraudScore: click.fraudScore,
        timeSinceClickMs: Date.now() - click.createdAt.getTime(),
        conversionValue: payout,
        campaignId,
        streamerId,
        ipHash,
      });
    });

    // Step 2: Update conversion with fraud score and status
    const newStatus = fraudResult.recommendation === "approve"
      ? "APPROVED"
      : fraudResult.recommendation === "reject"
        ? "REJECTED"
        : "UNDER_REVIEW";

    const conversion = await step.run("update-conversion", async () => {
      return db.conversion.update({
        where: { id: conversionId },
        data: {
          fraudScore: fraudResult.totalScore,
          status: newStatus as any,
          reviewedAt: newStatus !== "UNDER_REVIEW" ? new Date() : null,
        },
        include: {
          campaign: { include: { brand: { include: { user: true } } } },
          streamer: { include: { user: true } },
        },
      });
    });

    // Step 3: If approved, update balances
    if (newStatus === "APPROVED") {
      await step.run("update-balances", async () => {
        await db.$transaction([
          // Add to streamer's pending balance
          db.streamer.update({
            where: { id: streamerId },
            data: {
              balancePending: { increment: payout },
              totalEarned: { increment: payout },
            },
          }),
          // Update affiliate link stats
          db.affiliateLink.update({
            where: { id: event.data.affiliateLinkId },
            data: {
              totalConversions: { increment: 1 },
              totalEarnings: { increment: payout },
            },
          }),
          // Deduct from campaign budget
          db.campaign.update({
            where: { id: campaignId },
            data: {
              remainingBudget: { decrement: payout + conversion.platformFee },
              spent: { increment: payout + conversion.platformFee },
            },
          }),
          // Deduct from brand escrow
          db.brand.update({
            where: { id: conversion.campaign.brand.id },
            data: {
              escrowBalance: { decrement: payout + conversion.platformFee },
              totalSpent: { increment: payout + conversion.platformFee },
            },
          }),
        ]);
      });

      // Notify streamer
      await step.sendEvent("notify-streamer", {
        name: "notification/send",
        data: {
          userId: conversion.streamer.user.id,
          type: "CONVERSION",
          title: "New Conversion!",
          message: `You earned $${payout.toFixed(2)} from ${conversion.campaign.name}`,
          link: "/streamer/earnings",
          sendEmail: false,
        },
      });
    }

    // Step 4: If flagged, notify brand for review
    if (newStatus === "UNDER_REVIEW") {
      await step.sendEvent("notify-brand-review", {
        name: "notification/send",
        data: {
          userId: conversion.campaign.brand.user.id,
          type: "CONVERSION",
          title: "Conversion Flagged for Review",
          message: `A conversion on ${conversion.campaign.name} was flagged (score: ${fraudResult.totalScore}). Please review.`,
          link: `/brand/campaigns/${conversion.campaign.id}`,
          sendEmail: true,
        },
      });
    }

    return { conversionId, status: newStatus, fraudScore: fraudResult.totalScore };
  },
);

// ==========================================
// FUNCTION: Batch Calculate Payouts
// ==========================================

/**
 * Runs periodically (cron) to calculate payouts for all eligible streamers.
 * Fan-out pattern: sends one event per streamer.
 */
export const batchCalculatePayouts = inngest.createFunction(
  {
    id: "batch-calculate-payouts",
    concurrency: { limit: 1 }, // Only one batch at a time
  },
  { event: "payout/batch-calculate" },
  async ({ event, step }) => {
    const { periodStart, periodEnd } = event.data;

    // Find all streamers with approved conversions in the period
    const eligibleStreamers = await step.run("find-eligible", async () => {
      const streamers = await db.conversion.groupBy({
        by: ["streamerId"],
        where: {
          status: "APPROVED",
          createdAt: {
            gte: new Date(periodStart),
            lte: new Date(periodEnd),
          },
        },
        _sum: { payout: true },
        having: { payout: { _sum: { gte: 10 } } }, // Min $10 payout
      });
      return streamers;
    });

    // Fan out: send one event per streamer
    if (eligibleStreamers.length > 0) {
      await step.sendEvent(
        "fan-out-payouts",
        eligibleStreamers.map((s) => ({
          name: "payout/calculate" as const,
          data: {
            streamerId: s.streamerId,
            periodStart,
            periodEnd,
          },
        })),
      );
    }

    return { eligibleStreamers: eligibleStreamers.length };
  },
);

// ==========================================
// FUNCTION: Calculate Individual Payout
// ==========================================

export const calculatePayout = inngest.createFunction(
  {
    id: "calculate-payout",
    concurrency: { limit: 5 },
    retries: 2,
  },
  { event: "payout/calculate" },
  async ({ event, step }) => {
    const { streamerId, periodStart, periodEnd } = event.data;

    // Use distributed lock to prevent duplicate payouts
    const unlock = await acquireLock(`payout:${streamerId}`, 30_000);
    if (!unlock) {
      return { skipped: true, reason: "Lock not acquired — another payout in progress" };
    }

    try {
      // Sum approved conversions for this period
      const result = await step.run("sum-conversions", async () => {
        const agg = await db.conversion.aggregate({
          where: {
            streamerId,
            status: "APPROVED",
            createdAt: {
              gte: new Date(periodStart),
              lte: new Date(periodEnd),
            },
            // 14-day hold: only include conversions older than 14 days
            // This prevents paying out before fraud review window closes
            updatedAt: {
              lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            },
          },
          _sum: { payout: true },
          _count: true,
        });
        return { total: agg._sum.payout || 0, count: agg._count };
      });

      // Log hold-period filtering for transparency
      const heldBack = await step.run("check-held-conversions", async () => {
        const heldCount = await db.conversion.aggregate({
          where: {
            streamerId,
            status: "APPROVED",
            createdAt: {
              gte: new Date(periodStart),
              lte: new Date(periodEnd),
            },
            // These are within the 14-day hold window (not yet eligible)
            updatedAt: {
              gt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            },
          },
          _sum: { payout: true },
          _count: true,
        });
        return { heldTotal: heldCount._sum.payout || 0, heldCount: heldCount._count };
      });

      if (heldBack.heldCount > 0) {
        console.log(
          `[payout] Streamer ${streamerId}: $${heldBack.heldTotal.toFixed(2)} held back (${heldBack.heldCount} conversions within 14-day hold window)`
        );
      }

      if (result.total < 10) {
        return { skipped: true, reason: "Below minimum payout threshold ($10)" };
      }

      // Create payout record
      const payoutRecord = await step.run("create-payout", async () => {
        const streamer = await db.streamer.findUnique({
          where: { id: streamerId },
          select: { preferredPayout: true, paypalEmail: true, wiseEmail: true, userId: true },
        });

        if (!streamer) throw new Error(`Streamer ${streamerId} not found`);

        // Move from pending to available
        await db.streamer.update({
          where: { id: streamerId },
          data: {
            balancePending: { decrement: result.total },
            balanceAvailable: { increment: result.total },
          },
        });

        return db.payout.create({
          data: {
            streamerId,
            amount: result.total,
            method: streamer.preferredPayout || "paypal",
            status: "PENDING",
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
          },
        });
      });

      // Trigger actual payout processing
      await step.sendEvent("process-payout", {
        name: "payout/process",
        data: { payoutId: payoutRecord.id },
      });

      return { payoutId: payoutRecord.id, amount: result.total };
    } finally {
      await unlock();
    }
  },
);

// ==========================================
// FUNCTION: Process Payout (external transfer)
// ==========================================

export const processPayout = inngest.createFunction(
  {
    id: "process-payout",
    concurrency: { limit: 3 },
    retries: 2,
  },
  { event: "payout/process" },
  async ({ event, step }) => {
    const { payoutId } = event.data;

    const payout = await step.run("get-payout", async () => {
      return db.payout.findUniqueOrThrow({
        where: { id: payoutId },
        include: {
          streamer: { include: { user: true } },
        },
      });
    });

    // Mark as processing
    await step.run("mark-processing", async () => {
      await db.payout.update({
        where: { id: payoutId },
        data: { status: "PROCESSING" },
      });
    });

    // Execute external payout
    const result = await step.run("execute-transfer", async () => {
      try {
        // Dynamic import based on method
        if (payout.method === "paypal") {
          const { createPayPalPayout } = await import("@/lib/paypal");
          const paypalResult = await createPayPalPayout({
            email: payout.streamer.paypalEmail!,
            amount: payout.amount,
            currency: "USD",
            note: `StreamCPA payout #${payout.id}`,
          });
          return { success: true, externalId: paypalResult.payoutBatchId };
        } else if (payout.method === "wise") {
          const { createWiseTransfer } = await import("@/lib/wise");
          const wiseResult = await createWiseTransfer({
            email: payout.streamer.wiseEmail!,
            amount: payout.amount,
            currency: "USD",
            reference: `SCP-${payout.id}`,
          });
          return { success: true, externalId: wiseResult.transferId };
        }
        throw new Error(`Unsupported payout method: ${payout.method}`);
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Update payout record
    await step.run("finalize-payout", async () => {
      if (result.success) {
        await db.$transaction([
          db.payout.update({
            where: { id: payoutId },
            data: {
              status: "COMPLETED",
              externalId: result.externalId,
              processedAt: new Date(),
            },
          }),
          db.streamer.update({
            where: { id: payout.streamerId },
            data: {
              balanceAvailable: { decrement: payout.amount },
            },
          }),
        ]);
      } else {
        await db.payout.update({
          where: { id: payoutId },
          data: {
            status: "FAILED",
            failureReason: result.error,
          },
        });
      }
    });

    // Notify streamer
    await step.sendEvent("notify-payout-result", {
      name: "notification/send",
      data: {
        userId: payout.streamer.user.id,
        type: "PAYOUT",
        title: result.success ? "Payout Sent!" : "Payout Failed",
        message: result.success
          ? `$${payout.amount.toFixed(2)} sent via ${payout.method}`
          : `Payout of $${payout.amount.toFixed(2)} failed. We'll retry automatically.`,
        link: "/streamer/earnings",
        sendEmail: true,
      },
    });

    return { payoutId, success: result.success };
  },
);

// ==========================================
// FUNCTION: Send Notification
// ==========================================

export const sendNotification = inngest.createFunction(
  {
    id: "send-notification",
    concurrency: { limit: 20 },
    retries: 2,
  },
  { event: "notification/send" },
  async ({ event, step }) => {
    const { userId, type, title, message, link, sendEmail: shouldEmail } =
      event.data;

    // Create in-app notification
    await step.run("create-notification", async () => {
      await db.notification.create({
        data: {
          userId,
          type: type as any,
          title,
          message,
          link,
        },
      });
    });

    // Optionally send email
    if (shouldEmail) {
      await step.run("send-email", async () => {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (!user) return;

        await sendEmail({
          to: user.email,
          subject: title,
          html: emailTemplates.notification({
            name: user.name || "User",
            title,
            message,
            ctaText: link ? "View Details" : undefined,
            ctaUrl: link
              ? `${process.env.NEXT_PUBLIC_APP_URL}${link}`
              : undefined,
          }),
        });
      });
    }

    return { notified: userId };
  },
);

// ==========================================
// FUNCTION: Campaign Status Changed
// ==========================================

export const campaignStatusChanged = inngest.createFunction(
  {
    id: "campaign-status-changed",
    retries: 2,
  },
  { event: "campaign/status-changed" },
  async ({ event, step }) => {
    const { campaignId, newStatus } = event.data;

    // If campaign completed or cancelled, notify all active streamers
    if (newStatus === "COMPLETED" || newStatus === "CANCELLED") {
      const links = await step.run("get-active-links", async () => {
        return db.affiliateLink.findMany({
          where: { campaignId, isActive: true },
          include: { streamer: { include: { user: true } } },
        });
      });

      // Deactivate all links
      await step.run("deactivate-links", async () => {
        await db.affiliateLink.updateMany({
          where: { campaignId },
          data: { isActive: false },
        });
      });

      // Notify each streamer
      if (links.length > 0) {
        const campaign = await step.run("get-campaign", async () => {
          return db.campaign.findUnique({
            where: { id: campaignId },
            select: { name: true },
          });
        });

        await step.sendEvent(
          "notify-streamers",
          links.map((l) => ({
            name: "notification/send" as const,
            data: {
              userId: l.streamer.user.id,
              type: "CAMPAIGN",
              title: `Campaign ${newStatus === "COMPLETED" ? "Completed" : "Cancelled"}`,
              message: `${campaign?.name || "A campaign"} you were promoting has ${newStatus.toLowerCase()}. Your link has been deactivated.`,
              link: "/streamer/links",
              sendEmail: true,
            },
          })),
        );
      }

      return { notified: links.length };
    }

    return { skipped: true, reason: `No action for status: ${newStatus}` };
  },
);

// ==========================================
// EXPORTS
// ==========================================

/** All Inngest functions — register in app/api/inngest/route.ts */
export const functions = [
  processConversion,
  batchCalculatePayouts,
  calculatePayout,
  processPayout,
  sendNotification,
  campaignStatusChanged,
];
