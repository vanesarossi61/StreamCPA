/**
 * Auth router — user profile and session management
 */
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";

export const authRouter = createTRPCRouter({
  /** Get current user session with profile data */
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) return null;

    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        streamer: {
          select: {
            id: true,
            twitchUsername: true,
            twitchAvatar: true,
            status: true,
            onboardingStep: true,
            streamerScore: true,
            balanceAvailable: true,
          },
        },
        brand: {
          select: {
            id: true,
            companyName: true,
            logo: true,
            status: true,
            escrowBalance: true,
          },
        },
      },
    });

    return user;
  }),

  /** Update user profile */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        image: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: input,
      });
    }),
});
