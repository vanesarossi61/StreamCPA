/**
 * Root tRPC router
 * Merges all sub-routers into a single API
 */
import { createTRPCRouter } from "@/server/trpc";
import { authRouter } from "@/server/routers/auth";
import { streamerRouter } from "@/server/routers/streamer";
import { brandRouter } from "@/server/routers/brand";
import { campaignRouter } from "@/server/routers/campaign";
import { trackingRouter } from "@/server/routers/tracking";
import { payoutRouter } from "@/server/routers/payout";
import { adminRouter } from "@/server/routers/admin";
import { notificationRouter } from "@/server/routers/notification";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  streamer: streamerRouter,
  brand: brandRouter,
  campaign: campaignRouter,
  tracking: trackingRouter,
  payout: payoutRouter,
  admin: adminRouter,
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
