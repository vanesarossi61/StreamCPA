/**
 * Admin router — full platform administration
 * Covers: stats, users, brands, campaigns, fraud, payouts, revenue
 */
import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";

export const adminRouter = createTRPCRouter({
  // ==========================================
  // PLATFORM STATS
  // ==========================================

  /** Overview stats for admin dashboard */
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [
      totalUsers,
      totalStreamers,
      totalBrands,
      pendingBrands,
      totalCampaigns,
      activeCampaigns,
      totalConversions,
      totalPayouts,
      pendingPayouts,
      flaggedClicks,
      underReviewConversions,
    ] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.streamer.count({ where: { status: "ACTIVE" } }),
      ctx.db.brand.count({ where: { status: "ACTIVE" } }),
      ctx.db.brand.count({ where: { status: "PENDING_VERIFICATION" } }),
      ctx.db.campaign.count(),
      ctx.db.campaign.count({ where: { status: "ACTIVE" } }),
      ctx.db.conversion.count({ where: { status: "APPROVED" } }),
      ctx.db.payout.count({ where: { status: "COMPLETED" } }),
      ctx.db.payout.count({ where: { status: "PENDING" } }),
      ctx.db.click.count({ where: { flagged: true } }),
      ctx.db.conversion.count({ where: { status: "UNDER_REVIEW" } }),
    ]);

    return {
      totalUsers,
      totalStreamers,
      totalBrands,
      pendingBrands,
      totalCampaigns,
      activeCampaigns,
      totalConversions,
      totalPayouts,
      pendingPayouts,
      flaggedClicks,
      underReviewConversions,
    };
  }),

  /** Revenue stats with period comparison */
  getRevenueStats: adminProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

      // Current period
      const [currentConversions, currentDeposits, currentPayouts] = await Promise.all([
        ctx.db.conversion.aggregate({
          where: {
            status: "APPROVED",
            createdAt: { gte: periodStart },
          },
          _sum: { platformFee: true, totalAmount: true, payout: true },
          _count: true,
        }),
        ctx.db.deposit.aggregate({
          where: {
            status: "COMPLETED",
            createdAt: { gte: periodStart },
          },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.payout.aggregate({
          where: {
            status: "COMPLETED",
            processedAt: { gte: periodStart },
          },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

      // Previous period for comparison
      const [prevConversions, prevDeposits] = await Promise.all([
        ctx.db.conversion.aggregate({
          where: {
            status: "APPROVED",
            createdAt: { gte: prevPeriodStart, lt: periodStart },
          },
          _sum: { platformFee: true, totalAmount: true },
          _count: true,
        }),
        ctx.db.deposit.aggregate({
          where: {
            status: "COMPLETED",
            createdAt: { gte: prevPeriodStart, lt: periodStart },
          },
          _sum: { amount: true },
        }),
      ]);

      const platformRevenue = currentConversions._sum.platformFee || 0;
      const prevPlatformRevenue = prevConversions._sum.platformFee || 0;
      const revenueChange = prevPlatformRevenue > 0
        ? ((platformRevenue - prevPlatformRevenue) / prevPlatformRevenue) * 100
        : 0;

      const totalGMV = currentConversions._sum.totalAmount || 0;
      const prevGMV = prevConversions._sum.totalAmount || 0;
      const gmvChange = prevGMV > 0 ? ((totalGMV - prevGMV) / prevGMV) * 100 : 0;

      return {
        period: { days, start: periodStart, end: now },
        platformRevenue,
        revenueChange,
        totalGMV,
        gmvChange,
        totalDeposits: currentDeposits._sum.amount || 0,
        prevDeposits: prevDeposits._sum.amount || 0,
        totalPayoutsAmount: currentPayouts._sum.amount || 0,
        totalPayoutsCount: currentPayouts._count,
        conversionsCount: currentConversions._count,
        prevConversionsCount: prevConversions._count,
        streamerPayouts: currentConversions._sum.payout || 0,
      };
    }),

  /** Revenue by day for charts */
  getRevenueByDay: adminProcedure
    .input(
      z.object({
        days: z.number().min(7).max(90).default(30),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const days = input?.days ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const conversions = await ctx.db.conversion.findMany({
        where: {
          status: "APPROVED",
          createdAt: { gte: since },
        },
        select: {
          createdAt: true,
          platformFee: true,
          payout: true,
          totalAmount: true,
        },
      });

      // Group by day
      const byDay: Record<string, { revenue: number; gmv: number; payouts: number; count: number }> = {};

      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split("T")[0];
        byDay[key] = { revenue: 0, gmv: 0, payouts: 0, count: 0 };
      }

      for (const c of conversions) {
        const key = c.createdAt.toISOString().split("T")[0];
        if (byDay[key]) {
          byDay[key].revenue += c.platformFee;
          byDay[key].gmv += c.totalAmount;
          byDay[key].payouts += c.payout;
          byDay[key].count += 1;
        }
      }

      return Object.entries(byDay).map(([date, data]) => ({
        label: date,
        ...data,
      }));
    }),

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /** List all users with pagination */
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        role: z.enum(["STREAMER", "BRAND", "ADMIN"]).optional(),
        search: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        sortBy: z.enum(["createdAt", "name", "email"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, role, search, status, sortBy, sortDir } = input;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (role) where.role = role;
      if (status === "active") where.isActive = true;
      if (status === "inactive") where.isActive = false;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      const [users, total] = await Promise.all([
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            streamer: {
              select: {
                twitchUsername: true,
                status: true,
                streamerScore: true,
                totalEarned: true,
                balanceAvailable: true,
              },
            },
            brand: {
              select: {
                companyName: true,
                status: true,
                totalSpent: true,
                escrowBalance: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortDir },
        }),
        ctx.db.user.count({ where }),
      ]);

      return {
        users,
        total,
        pages: Math.ceil(total / limit),
        page,
      };
    }),

  /** Ban/unban a user */
  toggleUserActive: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      if (user.role === "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot ban admin users" });
      }

      // Also update streamer/brand status
      const updates: Promise<any>[] = [
        ctx.db.user.update({
          where: { id: input.userId },
          data: { isActive: input.active },
        }),
      ];

      if (user.role === "STREAMER") {
        updates.push(
          ctx.db.streamer.updateMany({
            where: { userId: input.userId },
            data: { status: input.active ? "ACTIVE" : "SUSPENDED" },
          })
        );
      }
      if (user.role === "BRAND") {
        updates.push(
          ctx.db.brand.updateMany({
            where: { userId: input.userId },
            data: { status: input.active ? "ACTIVE" : "SUSPENDED" },
          })
        );
      }

      await Promise.all(updates);
      return { success: true, userId: input.userId, isActive: input.active };
    }),

  /** Get single user details */
  getUserDetail: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        include: {
          streamer: {
            include: {
              _count: {
                select: {
                  affiliateLinks: true,
                  conversions: { where: { status: "APPROVED" } },
                  clicks: true,
                  payouts: { where: { status: "COMPLETED" } },
                },
              },
            },
          },
          brand: {
            include: {
              _count: { select: { campaigns: true, deposits: true } },
            },
          },
        },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

  // ==========================================
  // BRAND VERIFICATION
  // ==========================================

  /** List brands pending verification */
  getPendingBrands: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.brand.findMany({
      where: { status: "PENDING_VERIFICATION" },
      include: {
        user: { select: { name: true, email: true, createdAt: true } },
        _count: { select: { campaigns: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }),

  /** Approve a brand */
  approveBrand: adminProcedure
    .input(z.object({ brandId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.db.brand.findUnique({
        where: { id: input.brandId },
      });
      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.brand.update({
        where: { id: input.brandId },
        data: { status: "ACTIVE", verifiedAt: new Date() },
      });
    }),

  /** Reject a brand */
  rejectBrand: adminProcedure
    .input(
      z.object({
        brandId: z.string(),
        reason: z.string().min(10, "Please provide a reason for rejection"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.brand.update({
        where: { id: input.brandId },
        data: { status: "REJECTED", rejectionReason: input.reason },
      });
    }),

  // ==========================================
  // CAMPAIGN MODERATION
  // ==========================================

  /** List all campaigns with filters */
  listCampaigns: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, search } = input;
      const where: any = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { brand: { companyName: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [campaigns, total] = await Promise.all([
        ctx.db.campaign.findMany({
          where,
          include: {
            brand: { select: { companyName: true, logo: true, status: true } },
            _count: {
              select: {
                applications: true,
                clicks: true,
                conversions: { where: { status: "APPROVED" } },
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.campaign.count({ where }),
      ]);

      return {
        campaigns,
        total,
        pages: Math.ceil(total / limit),
        page,
      };
    }),

  /** Force-pause or cancel a campaign */
  moderateCampaign: adminProcedure
    .input(
      z.object({
        campaignId: z.string(),
        action: z.enum(["PAUSE", "CANCEL", "ACTIVATE"]),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
      });
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      const statusMap = {
        PAUSE: "PAUSED" as const,
        CANCEL: "CANCELLED" as const,
        ACTIVATE: "ACTIVE" as const,
      };

      return ctx.db.campaign.update({
        where: { id: input.campaignId },
        data: { status: statusMap[input.action] },
      });
    }),

  // ==========================================
  // FRAUD MANAGEMENT
  // ==========================================

  /** List flagged clicks (fraud cases) */
  listFraudCases: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        status: z.enum(["open", "resolved"]).optional(),
        streamerId: z.string().optional(),
        campaignId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, severity, status, streamerId, campaignId } = input;

      const where: any = { flagged: true };
      if (streamerId) where.streamerId = streamerId;
      if (campaignId) where.campaignId = campaignId;

      // Severity based on fraud score
      if (severity === "low") where.fraudScore = { gte: 1, lt: 30 };
      if (severity === "medium") where.fraudScore = { gte: 30, lt: 60 };
      if (severity === "high") where.fraudScore = { gte: 60, lt: 85 };
      if (severity === "critical") where.fraudScore = { gte: 85 };

      // Status: open = no resolved conversion, resolved = conversion reviewed
      if (status === "resolved") {
        where.conversions = { some: { reviewedAt: { not: null } } };
      }
      if (status === "open") {
        where.OR = [
          { conversions: { none: {} } },
          { conversions: { every: { reviewedAt: null } } },
        ];
      }

      const [clicks, total] = await Promise.all([
        ctx.db.click.findMany({
          where,
          include: {
            streamer: {
              select: {
                twitchDisplayName: true,
                twitchAvatar: true,
                userId: true,
              },
            },
            campaign: {
              select: { name: true, slug: true },
            },
            conversions: {
              select: {
                id: true,
                payout: true,
                status: true,
                fraudScore: true,
                reviewedAt: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { fraudScore: "desc" },
        }),
        ctx.db.click.count({ where }),
      ]);

      return {
        cases: clicks.map((click) => ({
          id: click.id,
          clickId: click.clickId,
          fraudScore: click.fraudScore,
          flagReason: click.flagReason,
          severity: scoreSeverity(click.fraudScore),
          ipHash: click.ipHash,
          country: click.country,
          device: click.device,
          userAgent: click.userAgent,
          createdAt: click.createdAt,
          streamer: click.streamer,
          campaign: click.campaign,
          conversions: click.conversions,
          isResolved: click.conversions.some((c) => c.reviewedAt != null),
          totalAmount: click.conversions.reduce((s, c) => s + c.payout, 0),
        })),
        total,
        pages: Math.ceil(total / limit),
        page,
      };
    }),

  /** Fraud summary stats */
  getFraudStats: adminProcedure.query(async ({ ctx }) => {
    const [totalFlagged, criticalCount, underReview, resolvedCount] = await Promise.all([
      ctx.db.click.count({ where: { flagged: true } }),
      ctx.db.click.count({ where: { flagged: true, fraudScore: { gte: 85 } } }),
      ctx.db.conversion.count({ where: { status: "UNDER_REVIEW" } }),
      ctx.db.conversion.count({
        where: {
          status: { in: ["APPROVED", "REJECTED"] },
          reviewedAt: { not: null },
          fraudScore: { gt: 0 },
        },
      }),
    ]);

    // Amount at risk
    const atRisk = await ctx.db.conversion.aggregate({
      where: { status: "UNDER_REVIEW" },
      _sum: { payout: true },
    });

    return {
      totalFlagged,
      criticalCount,
      underReview,
      resolvedCount,
      amountAtRisk: atRisk._sum.payout || 0,
    };
  }),

  /** Resolve a fraud case — approve or reject the related conversions */
  resolveFraudCase: adminProcedure
    .input(
      z.object({
        clickId: z.string(),
        action: z.enum(["APPROVE", "REJECT"]),
        resolution: z.string().min(5, "Please describe the resolution"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const click = await ctx.db.click.findUnique({
        where: { id: input.clickId },
        include: { conversions: true },
      });

      if (!click) throw new TRPCError({ code: "NOT_FOUND" });
      if (!click.flagged) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Click is not flagged" });
      }

      const newStatus = input.action === "APPROVE" ? "APPROVED" : "REJECTED";

      // Update all related conversions
      const conversionUpdates = click.conversions.map((conv) =>
        ctx.db.conversion.update({
          where: { id: conv.id },
          data: {
            status: newStatus,
            reviewedAt: new Date(),
            reviewedBy: ctx.session.user.id,
          },
        })
      );

      // If rejecting, we need to reverse pending balance
      const balanceUpdates: Promise<any>[] = [];
      if (input.action === "REJECT" && click.conversions.length > 0) {
        const totalPayout = click.conversions.reduce((s, c) => s + c.payout, 0);
        balanceUpdates.push(
          ctx.db.streamer.update({
            where: { id: click.streamerId },
            data: { balancePending: { decrement: totalPayout } },
          })
        );
        // Refund to campaign remaining budget
        const totalAmount = click.conversions.reduce((s, c) => s + c.totalAmount, 0);
        balanceUpdates.push(
          ctx.db.campaign.update({
            where: { id: click.campaignId },
            data: { remainingBudget: { increment: totalAmount } },
          })
        );
      }

      // If approving, move from pending to available
      if (input.action === "APPROVE" && click.conversions.length > 0) {
        const totalPayout = click.conversions.reduce((s, c) => s + c.payout, 0);
        balanceUpdates.push(
          ctx.db.streamer.update({
            where: { id: click.streamerId },
            data: {
              balancePending: { decrement: totalPayout },
              balanceAvailable: { increment: totalPayout },
            },
          })
        );
      }

      await Promise.all([...conversionUpdates, ...balanceUpdates]);

      // Clear the flag (mark as reviewed)
      await ctx.db.click.update({
        where: { id: input.clickId },
        data: {
          flagReason: `${click.flagReason || ""} [RESOLVED: ${input.action} - ${input.resolution}]`,
        },
      });

      return {
        success: true,
        action: input.action,
        conversionsUpdated: click.conversions.length,
      };
    }),

  // ==========================================
  // PAYOUT MANAGEMENT
  // ==========================================

  /** List payouts with filters */
  listPayouts: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
        method: z.enum(["paypal", "wise"]).optional(),
        streamerId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, method, streamerId } = input;
      const where: any = {};
      if (status) where.status = status;
      if (method) where.method = method;
      if (streamerId) where.streamerId = streamerId;

      const [payouts, total, totalAmount] = await Promise.all([
        ctx.db.payout.findMany({
          where,
          include: {
            streamer: {
              select: {
                twitchDisplayName: true,
                twitchAvatar: true,
                paypalEmail: true,
                wiseEmail: true,
              },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { requestedAt: "desc" },
        }),
        ctx.db.payout.count({ where }),
        ctx.db.payout.aggregate({
          where,
          _sum: { amount: true },
        }),
      ]);

      return {
        payouts,
        total,
        pages: Math.ceil(total / limit),
        page,
        totalAmount: totalAmount._sum.amount || 0,
      };
    }),

  /** Payout summary stats */
  getPayoutStats: adminProcedure.query(async ({ ctx }) => {
    const [pending, processing, completed, failed] = await Promise.all([
      ctx.db.payout.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      ctx.db.payout.aggregate({
        where: { status: "PROCESSING" },
        _sum: { amount: true },
        _count: true,
      }),
      ctx.db.payout.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
        _count: true,
      }),
      ctx.db.payout.aggregate({
        where: { status: "FAILED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      pending: { count: pending._count, amount: pending._sum.amount || 0 },
      processing: { count: processing._count, amount: processing._sum.amount || 0 },
      completed: { count: completed._count, amount: completed._sum.amount || 0 },
      failed: { count: failed._count, amount: failed._sum.amount || 0 },
    };
  }),

  /** Manually approve/process a payout */
  processPayout: adminProcedure
    .input(
      z.object({
        payoutId: z.string(),
        action: z.enum(["APPROVE", "REJECT", "MARK_COMPLETED"]),
        externalId: z.string().optional(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payout = await ctx.db.payout.findUnique({
        where: { id: input.payoutId },
      });
      if (!payout) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.action === "APPROVE") {
        if (payout.status !== "PENDING") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only pending payouts can be approved" });
        }
        return ctx.db.payout.update({
          where: { id: input.payoutId },
          data: { status: "PROCESSING" },
        });
      }

      if (input.action === "MARK_COMPLETED") {
        if (payout.status !== "PROCESSING") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only processing payouts can be completed" });
        }
        return ctx.db.payout.update({
          where: { id: input.payoutId },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
            externalId: input.externalId || payout.externalId,
          },
        });
      }

      if (input.action === "REJECT") {
        if (payout.status === "COMPLETED") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot reject completed payouts" });
        }
        // Return funds to streamer balance
        await ctx.db.streamer.update({
          where: { id: payout.streamerId },
          data: { balanceAvailable: { increment: payout.amount } },
        });

        return ctx.db.payout.update({
          where: { id: input.payoutId },
          data: {
            status: "FAILED",
            failureReason: input.reason || "Rejected by admin",
          },
        });
      }
    }),

  /** Retry a failed payout */
  retryPayout: adminProcedure
    .input(z.object({ payoutId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payout = await ctx.db.payout.findUnique({
        where: { id: input.payoutId },
      });
      if (!payout) throw new TRPCError({ code: "NOT_FOUND" });
      if (payout.status !== "FAILED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed payouts can be retried" });
      }

      // Deduct from available balance again
      await ctx.db.streamer.update({
        where: { id: payout.streamerId },
        data: { balanceAvailable: { decrement: payout.amount } },
      });

      return ctx.db.payout.update({
        where: { id: input.payoutId },
        data: {
          status: "PENDING",
          failureReason: null,
        },
      });
    }),

  // ==========================================
  // CONVERSION REVIEW
  // ==========================================

  /** List conversions needing review */
  listConversionsForReview: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
        status: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"]).optional(),
        campaignId: z.string().optional(),
        streamerId: z.string().optional(),
        minFraudScore: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, status, campaignId, streamerId, minFraudScore } = input;
      const where: any = {};
      if (status) where.status = status;
      if (campaignId) where.campaignId = campaignId;
      if (streamerId) where.streamerId = streamerId;
      if (minFraudScore) where.fraudScore = { gte: minFraudScore };

      const [conversions, total] = await Promise.all([
        ctx.db.conversion.findMany({
          where,
          include: {
            streamer: {
              select: { twitchDisplayName: true, twitchAvatar: true },
            },
            campaign: {
              select: { name: true, slug: true, payoutPerConversion: true },
            },
            click: {
              select: {
                ipHash: true,
                country: true,
                device: true,
                flagged: true,
                flagReason: true,
              },
            },
            reviewer: {
              select: { name: true },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.conversion.count({ where }),
      ]);

      return { conversions, total, pages: Math.ceil(total / limit), page };
    }),

  /** Review a conversion (approve/reject) */
  reviewConversion: adminProcedure
    .input(
      z.object({
        conversionId: z.string(),
        action: z.enum(["APPROVE", "REJECT"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conversion = await ctx.db.conversion.findUnique({
        where: { id: input.conversionId },
      });
      if (!conversion) throw new TRPCError({ code: "NOT_FOUND" });
      if (conversion.status === "APPROVED" || conversion.status === "REJECTED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conversion already reviewed" });
      }

      const newStatus = input.action === "APPROVE" ? "APPROVED" : "REJECTED";

      // Update conversion
      const updated = await ctx.db.conversion.update({
        where: { id: input.conversionId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          reviewedBy: ctx.session.user.id,
        },
      });

      // Balance adjustments
      if (input.action === "APPROVE") {
        await ctx.db.streamer.update({
          where: { id: conversion.streamerId },
          data: {
            balancePending: { decrement: conversion.payout },
            balanceAvailable: { increment: conversion.payout },
          },
        });
      } else {
        // Rejected: remove from pending, return to campaign
        await Promise.all([
          ctx.db.streamer.update({
            where: { id: conversion.streamerId },
            data: { balancePending: { decrement: conversion.payout } },
          }),
          ctx.db.campaign.update({
            where: { id: conversion.campaignId },
            data: { remainingBudget: { increment: conversion.totalAmount } },
          }),
        ]);
      }

      return updated;
    }),
});

// ==========================================
// Helpers
// ==========================================

function scoreSeverity(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 85) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}
