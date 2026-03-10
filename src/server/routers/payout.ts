/**
 * Payout router — withdrawal requests, payment processing, deposit management
 */
import { z } from "zod";
import {
  createTRPCRouter,
  streamerProcedure,
  brandProcedure,
  adminProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import {
  createStripeCheckout,
  getOrCreateStripeCustomer,
  sendPayPalPayout,
  sendWisePayout,
} from "@/lib/payments";

const MIN_PAYOUT = 10; // $10 minimum withdrawal

export const payoutRouter = createTRPCRouter({
  // ==========================================
  // STREAMER — Withdrawals
  // ==========================================

  /** Request a withdrawal */
  requestWithdrawal: streamerProcedure
    .input(
      z.object({
        amount: z.number().min(MIN_PAYOUT),
        method: z.enum(["paypal", "wise"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!streamer) throw new TRPCError({ code: "NOT_FOUND" });

      if (streamer.balanceAvailable < input.amount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient balance. Available: $${streamer.balanceAvailable.toFixed(2)}`,
        });
      }

      // Validate payment method is configured
      if (input.method === "paypal" && !streamer.paypalEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please configure your PayPal email in settings first",
        });
      }
      if (input.method === "wise" && !streamer.wiseEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please configure your Wise email in settings first",
        });
      }

      // Create payout request and deduct from available balance
      const payout = await ctx.db.$transaction(async (tx) => {
        // Deduct from balance
        await tx.streamer.update({
          where: { id: streamer.id },
          data: { balanceAvailable: { decrement: input.amount } },
        });

        // Create payout record
        return tx.payout.create({
          data: {
            streamerId: streamer.id,
            amount: input.amount,
            method: input.method,
            status: "PENDING",
            periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
            periodEnd: new Date(),
          },
        });
      });

      return payout;
    }),

  /** Get withdrawal history */
  getMyPayouts: streamerProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!streamer) throw new TRPCError({ code: "NOT_FOUND" });

      const page = input?.page || 1;
      const limit = input?.limit || 10;

      const [payouts, total] = await Promise.all([
        ctx.db.payout.findMany({
          where: { streamerId: streamer.id },
          orderBy: { requestedAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.payout.count({ where: { streamerId: streamer.id } }),
      ]);

      return { payouts, total, pages: Math.ceil(total / limit) };
    }),

  // ==========================================
  // BRAND — Deposits
  // ==========================================

  /** Create a deposit (Stripe Checkout) */
  createDeposit: brandProcedure
    .input(z.object({ amount: z.number().min(50) })) // $50 minimum deposit
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.db.brand.findUnique({
        where: { userId: ctx.session.user.id },
        include: { user: { select: { email: true } } },
      });

      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });

      // Ensure Stripe customer exists
      let stripeCustomerId = brand.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await getOrCreateStripeCustomer(
          brand.user.email || brand.contactEmail || "",
          brand.companyName,
        );
        stripeCustomerId = customer.id;
        await ctx.db.brand.update({
          where: { id: brand.id },
          data: { stripeCustomerId },
        });
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      const session = await createStripeCheckout({
        brandId: brand.id,
        amount: Math.round(input.amount * 100), // Convert to cents
        stripeCustomerId,
        successUrl: `${appUrl}/brand/billing?deposit=success`,
        cancelUrl: `${appUrl}/brand/billing?deposit=cancelled`,
      });

      return { checkoutUrl: session.url };
    }),

  /** Get deposit history */
  getMyDeposits: brandProcedure.query(async ({ ctx }) => {
    const brand = await ctx.db.brand.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!brand) throw new TRPCError({ code: "NOT_FOUND" });

    return ctx.db.deposit.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }),

  // ==========================================
  // ADMIN — Process payouts
  // ==========================================

  /** Get pending payouts */
  getPendingPayouts: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.payout.findMany({
      where: { status: "PENDING" },
      include: {
        streamer: {
          select: {
            twitchDisplayName: true,
            paypalEmail: true,
            wiseEmail: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: { requestedAt: "asc" },
    });
  }),

  /** Process a single payout */
  processPayout: adminProcedure
    .input(z.object({ payoutId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payout = await ctx.db.payout.findUnique({
        where: { id: input.payoutId },
        include: {
          streamer: {
            select: {
              paypalEmail: true,
              wiseEmail: true,
              user: { select: { name: true } },
            },
          },
        },
      });

      if (!payout) throw new TRPCError({ code: "NOT_FOUND" });
      if (payout.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Payout is not pending" });
      }

      // Update to processing
      await ctx.db.payout.update({
        where: { id: payout.id },
        data: { status: "PROCESSING" },
      });

      try {
        let externalId: string;

        if (payout.method === "paypal") {
          const result = await sendPayPalPayout({
            email: payout.streamer.paypalEmail!,
            amount: payout.amount,
            payoutId: payout.id,
          });
          externalId = result.batchId;
        } else {
          const result = await sendWisePayout({
            email: payout.streamer.wiseEmail!,
            amount: payout.amount,
            payoutId: payout.id,
            recipientName: payout.streamer.user.name || "StreamCPA User",
          });
          externalId = result.transferId;
        }

        // Mark as completed
        await ctx.db.payout.update({
          where: { id: payout.id },
          data: {
            status: "COMPLETED",
            externalId,
            processedAt: new Date(),
          },
        });

        return { success: true, externalId };
      } catch (error: any) {
        // Mark as failed
        await ctx.db.payout.update({
          where: { id: payout.id },
          data: {
            status: "FAILED",
            failureReason: error.message,
          },
        });

        // Refund the streamer's balance
        await ctx.db.streamer.update({
          where: { id: payout.streamerId },
          data: { balanceAvailable: { increment: payout.amount } },
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Payout failed: ${error.message}`,
        });
      }
    }),
});
