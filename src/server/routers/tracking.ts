/**
 * Tracking router — affiliate link management, click/conversion queries
 */
import { z } from "zod";
import {
  createTRPCRouter,
  streamerProcedure,
  brandProcedure,
  adminProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { generateLinkSlug } from "@/lib/tracking";

export const trackingRouter = createTRPCRouter({
  // ==========================================
  // STREAMER — Link management
  // ==========================================

  /** Generate affiliate link for an approved campaign */
  generateLink: streamerProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!streamer) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify approved application
      const application = await ctx.db.campaignApplication.findUnique({
        where: {
          campaignId_streamerId: {
            campaignId: input.campaignId,
            streamerId: streamer.id,
          },
        },
      });

      if (!application || application.status !== "APPROVED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be approved for this campaign first",
        });
      }

      // Check if link already exists
      const existing = await ctx.db.affiliateLink.findUnique({
        where: {
          campaignId_streamerId: {
            campaignId: input.campaignId,
            streamerId: streamer.id,
          },
        },
      });

      if (existing) {
        return existing; // Return existing link
      }

      // Get campaign landing URL
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
        select: { landingUrl: true },
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      // Generate unique slug
      let slug = generateLinkSlug();
      let attempts = 0;
      while (attempts < 5) {
        const exists = await ctx.db.affiliateLink.findUnique({ where: { slug } });
        if (!exists) break;
        slug = generateLinkSlug();
        attempts++;
      }

      // Create affiliate link
      const link = await ctx.db.affiliateLink.create({
        data: {
          slug,
          campaignId: input.campaignId,
          streamerId: streamer.id,
          targetUrl: campaign.landingUrl,
        },
      });

      return link;
    }),

  /** List streamer's affiliate links */
  listMyLinks: streamerProcedure.query(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!streamer) throw new TRPCError({ code: "NOT_FOUND" });

    return ctx.db.affiliateLink.findMany({
      where: { streamerId: streamer.id },
      include: {
        campaign: {
          select: {
            name: true,
            slug: true,
            payoutPerConversion: true,
            conversionType: true,
            status: true,
            brand: { select: { companyName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Get click analytics for a specific link */
  getLinkAnalytics: streamerProcedure
    .input(
      z.object({
        linkId: z.string(),
        days: z.number().min(1).max(90).default(7),
      }),
    )
    .query(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!streamer) throw new TRPCError({ code: "NOT_FOUND" });

      const link = await ctx.db.affiliateLink.findFirst({
        where: { id: input.linkId, streamerId: streamer.id },
      });

      if (!link) throw new TRPCError({ code: "NOT_FOUND" });

      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const [clicks, conversions, clicksByCountry, clicksByDevice] = await Promise.all([
        ctx.db.click.count({
          where: { affiliateLinkId: link.id, createdAt: { gte: since } },
        }),
        ctx.db.conversion.count({
          where: { affiliateLinkId: link.id, createdAt: { gte: since }, status: "APPROVED" },
        }),
        ctx.db.click.groupBy({
          by: ["country"],
          where: { affiliateLinkId: link.id, createdAt: { gte: since } },
          _count: true,
          orderBy: { _count: { country: "desc" } },
          take: 10,
        }),
        ctx.db.click.groupBy({
          by: ["device"],
          where: { affiliateLinkId: link.id, createdAt: { gte: since } },
          _count: true,
        }),
      ]);

      return {
        clicks,
        conversions,
        cvr: clicks > 0 ? conversions / clicks : 0,
        earnings: link.totalEarnings,
        clicksByCountry: clicksByCountry.map((c) => ({
          country: c.country || "Unknown",
          count: c._count,
        })),
        clicksByDevice: clicksByDevice.map((d) => ({
          device: d.device || "Unknown",
          count: d._count,
        })),
      };
    }),

  // ==========================================
  // ADMIN — Fraud review queue
  // ==========================================

  /** Get flagged clicks for review */
  getFlaggedClicks: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit } = input;

      const [clicks, total] = await Promise.all([
        ctx.db.click.findMany({
          where: { flagged: true },
          include: {
            affiliateLink: { select: { slug: true } },
            campaign: { select: { name: true } },
            streamer: { select: { twitchDisplayName: true } },
          },
          orderBy: { fraudScore: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.click.count({ where: { flagged: true } }),
      ]);

      return { clicks, total, pages: Math.ceil(total / limit) };
    }),

  /** Get conversions pending review */
  getPendingConversions: adminProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "UNDER_REVIEW"]).default("UNDER_REVIEW"),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { status, page, limit } = input;

      const [conversions, total] = await Promise.all([
        ctx.db.conversion.findMany({
          where: { status },
          include: {
            campaign: { select: { name: true } },
            streamer: { select: { twitchDisplayName: true } },
            click: { select: { ipHash: true, country: true, fraudScore: true, flagReason: true } },
          },
          orderBy: { fraudScore: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.conversion.count({ where: { status } }),
      ]);

      return { conversions, total, pages: Math.ceil(total / limit) };
    }),

  /** Approve or reject a conversion (admin) */
  reviewConversion: adminProcedure
    .input(
      z.object({
        conversionId: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversion = await ctx.db.conversion.findUnique({
        where: { id: input.conversionId },
      });

      if (!conversion) throw new TRPCError({ code: "NOT_FOUND" });

      // Update conversion and related records in transaction
      return ctx.db.$transaction(async (tx) => {
        const updated = await tx.conversion.update({
          where: { id: input.conversionId },
          data: {
            status: input.status,
            reviewNote: input.note,
            reviewedAt: new Date(),
            reviewedBy: ctx.session.user.id,
          },
        });

        if (input.status === "APPROVED" && conversion.status !== "APPROVED") {
          // Credit streamer
          await tx.streamer.update({
            where: { id: conversion.streamerId },
            data: {
              balancePending: { increment: conversion.payout },
              totalEarned: { increment: conversion.payout },
            },
          });

          // Debit campaign
          await tx.campaign.update({
            where: { id: conversion.campaignId },
            data: {
              spent: { increment: conversion.totalAmount },
              remainingBudget: { decrement: conversion.totalAmount },
            },
          });

          // Update link earnings
          await tx.affiliateLink.update({
            where: { id: conversion.affiliateLinkId },
            data: { totalEarnings: { increment: conversion.payout } },
          });
        }

        return updated;
      });
    }),
});
