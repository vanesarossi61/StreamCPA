/**
 * Streamer router — onboarding, profile management, dashboard data
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  streamerProcedure,
} from "@/server/trpc";
import { fetchTwitchChannelInfo, calculateStreamerScore } from "@/lib/twitch";
import { TRPCError } from "@trpc/server";

export const streamerRouter = createTRPCRouter({
  /** Get streamer profile with all details */
  getProfile: streamerProcedure.query(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.findUnique({
      where: { userId: ctx.session.user.id },
      include: {
        user: { select: { name: true, email: true, image: true } },
        _count: {
          select: {
            affiliateLinks: true,
            conversions: { where: { status: "APPROVED" } },
          },
        },
      },
    });

    if (!streamer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Streamer profile not found" });
    }

    return streamer;
  }),

  /** Get onboarding status */
  getOnboardingStatus: streamerProcedure.query(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.findUnique({
      where: { userId: ctx.session.user.id },
      select: {
        status: true,
        onboardingStep: true,
        twitchId: true,
        twitchUsername: true,
        twitchAvatar: true,
        twitchFollowers: true,
        avgViewers: true,
        bio: true,
        country: true,
        categories: true,
        termsAcceptedAt: true,
      },
    });

    if (!streamer) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Streamer profile not found" });
    }

    return streamer;
  }),

  /** Sync Twitch data — called during onboarding step 1 and periodic refresh */
  syncTwitch: streamerProcedure.mutation(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!streamer || !streamer.twitchId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Twitch account linked. Please sign in with Twitch first.",
      });
    }

    // Fetch latest data from Twitch API
    const channelInfo = await fetchTwitchChannelInfo(streamer.twitchId);

    // Calculate score
    const score = calculateStreamerScore({
      followers: channelInfo.followers,
      avgViewers: channelInfo.avgViewers,
      accountCreatedAt: new Date(channelInfo.user.created_at),
    });

    // Update streamer record
    const updated = await ctx.db.streamer.update({
      where: { userId: ctx.session.user.id },
      data: {
        twitchUsername: channelInfo.user.login,
        twitchDisplayName: channelInfo.user.display_name,
        twitchAvatar: channelInfo.user.profile_image_url,
        twitchFollowers: channelInfo.followers,
        avgViewers: channelInfo.avgViewers,
        mainCategory: channelInfo.mainCategory,
        streamerScore: score,
        lastSyncAt: new Date(),
        onboardingStep: Math.max(streamer.onboardingStep, 1),
      },
    });

    return {
      username: updated.twitchUsername,
      displayName: updated.twitchDisplayName,
      avatar: updated.twitchAvatar,
      followers: updated.twitchFollowers,
      avgViewers: updated.avgViewers,
      category: updated.mainCategory,
      score: updated.streamerScore,
    };
  }),

  /** Update streamer profile — onboarding step 2 */
  updateProfile: streamerProcedure
    .input(
      z.object({
        bio: z.string().max(500).optional(),
        country: z.string().min(2).max(2).optional(), // ISO country code
        languages: z.array(z.string()).max(5).optional(),
        categories: z.array(z.string()).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.update({
        where: { userId: ctx.session.user.id },
        data: {
          ...input,
          onboardingStep: 2,
        },
      });

      return streamer;
    }),

  /** Accept terms of service — onboarding step 3 (final) */
  acceptTerms: streamerProcedure.mutation(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.update({
      where: { userId: ctx.session.user.id },
      data: {
        termsAcceptedAt: new Date(),
        onboardingStep: 3,
        status: "ACTIVE",
      },
    });

    return { success: true, status: streamer.status };
  }),

  /** Update payment preferences */
  updatePaymentInfo: streamerProcedure
    .input(
      z.object({
        paypalEmail: z.string().email().optional().nullable(),
        wiseEmail: z.string().email().optional().nullable(),
        preferredPayout: z.enum(["paypal", "wise"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.streamer.update({
        where: { userId: ctx.session.user.id },
        data: input,
      });
    }),

  /** Get dashboard summary metrics */
  getDashboard: streamerProcedure.query(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.findUnique({
      where: { userId: ctx.session.user.id },
      select: {
        balanceAvailable: true,
        balancePending: true,
        totalEarned: true,
        streamerScore: true,
        twitchDisplayName: true,
        twitchAvatar: true,
        status: true,
      },
    });

    if (!streamer) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Get aggregated metrics
    const [clickCount, conversionCount, activeLinks] = await Promise.all([
      ctx.db.click.count({
        where: { streamer: { userId: ctx.session.user.id } },
      }),
      ctx.db.conversion.count({
        where: {
          streamer: { userId: ctx.session.user.id },
          status: { in: ["APPROVED", "PENDING"] },
        },
      }),
      ctx.db.affiliateLink.count({
        where: {
          streamer: { userId: ctx.session.user.id },
          isActive: true,
        },
      }),
    ]);

    return {
      ...streamer,
      totalClicks: clickCount,
      totalConversions: conversionCount,
      activeLinks,
      epc: clickCount > 0 ? streamer.totalEarned / clickCount : 0,
    };
  }),
});
