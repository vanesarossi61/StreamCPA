/**
 * Brand router — onboarding, profile, verification status
 */
import { z } from "zod";
import {
  createTRPCRouter,
  brandProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";

export const brandRouter = createTRPCRouter({
  /** Get brand profile */
  getProfile: brandProcedure.query(async ({ ctx }) => {
    const brand = await ctx.db.brand.findUnique({
      where: { userId: ctx.session.user.id },
      include: {
        user: { select: { name: true, email: true, image: true } },
        _count: { select: { campaigns: true } },
      },
    });

    if (!brand) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Brand profile not found" });
    }

    return brand;
  }),

  /** Update brand profile — onboarding */
  updateProfile: brandProcedure
    .input(
      z.object({
        companyName: z.string().min(2).optional(),
        website: z.string().url().optional().nullable(),
        industry: z.string().optional().nullable(),
        description: z.string().max(1000).optional().nullable(),
        logo: z.string().url().optional().nullable(),
        contactName: z.string().min(2).optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.brand.update({
        where: { userId: ctx.session.user.id },
        data: input,
      });
    }),

  /** Submit brand for verification */
  submitForVerification: brandProcedure.mutation(async ({ ctx }) => {
    const brand = await ctx.db.brand.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!brand) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Validate required fields
    if (!brand.companyName || !brand.contactEmail) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please complete your company profile before submitting for verification",
      });
    }

    if (brand.status !== "PENDING_VERIFICATION") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot submit for verification: current status is ${brand.status}`,
      });
    }

    // Status stays PENDING_VERIFICATION — admin will review
    return { success: true, status: brand.status };
  }),

  /** Get dashboard summary */
  getDashboard: brandProcedure.query(async ({ ctx }) => {
    const brand = await ctx.db.brand.findUnique({
      where: { userId: ctx.session.user.id },
      select: {
        companyName: true,
        logo: true,
        status: true,
        escrowBalance: true,
        totalSpent: true,
      },
    });

    if (!brand) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    const [campaignCount, totalConversions, activeStreamers] = await Promise.all([
      ctx.db.campaign.count({
        where: { brand: { userId: ctx.session.user.id } },
      }),
      ctx.db.conversion.count({
        where: {
          campaign: { brand: { userId: ctx.session.user.id } },
          status: "APPROVED",
        },
      }),
      ctx.db.campaignApplication.count({
        where: {
          campaign: { brand: { userId: ctx.session.user.id } },
          status: "APPROVED",
        },
      }),
    ]);

    return {
      ...brand,
      campaignCount,
      totalConversions,
      activeStreamers,
    };
  }),
});
