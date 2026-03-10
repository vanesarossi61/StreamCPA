/**
 * Campaign router — CRUD, marketplace listing, applications
 */
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  brandProcedure,
  streamerProcedure,
  protectedProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { slugify } from "@/lib/utils";

/** Schema for creating/updating a campaign */
const campaignInput = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(20).max(5000),
  shortDescription: z.string().max(200).optional(),
  landingUrl: z.string().url(),
  imageUrl: z.string().url().optional(),
  // CPA config
  conversionType: z.enum(["SALE", "LEAD", "INSTALL", "SIGNUP", "DEPOSIT", "SUBSCRIPTION"]),
  payoutPerConversion: z.number().min(0.01).max(10000),
  // Targeting
  categories: z.array(z.string()).max(10).default([]),
  countries: z.array(z.string()).max(50).default([]),
  minFollowers: z.number().min(0).default(0),
  minAvgViewers: z.number().min(0).default(0),
  // Budget
  totalBudget: z.number().min(10),
  dailyBudget: z.number().min(1).optional(),
  // Settings
  approvalMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
  maxStreamers: z.number().min(1).optional(),
  attributionWindow: z.number().min(1).max(90).default(30),
  // Dates
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/** Marketplace filter schema */
const marketplaceFilters = z.object({
  category: z.string().optional(),
  country: z.string().optional(),
  conversionType: z.enum(["SALE", "LEAD", "INSTALL", "SIGNUP", "DEPOSIT", "SUBSCRIPTION"]).optional(),
  minPayout: z.number().min(0).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["payout", "newest", "epc"]).default("newest"),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(12),
});

export const campaignRouter = createTRPCRouter({
  // ==========================================
  // PUBLIC — Marketplace
  // ==========================================

  /** List active campaigns for the marketplace (public) */
  listMarketplace: publicProcedure
    .input(marketplaceFilters)
    .query(async ({ ctx, input }) => {
      const { category, country, conversionType, minPayout, search, sortBy, page, limit } = input;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {
        status: "ACTIVE",
        brand: { status: "ACTIVE" },
      };

      if (category) {
        where.categories = { has: category };
      }
      if (country) {
        where.OR = [
          { countries: { isEmpty: true } }, // Global campaigns
          { countries: { has: country } },
        ];
      }
      if (conversionType) {
        where.conversionType = conversionType;
      }
      if (minPayout) {
        where.payoutPerConversion = { gte: minPayout };
      }
      if (search) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          },
        ];
      }

      // Build orderBy
      let orderBy: any = { createdAt: "desc" };
      if (sortBy === "payout") orderBy = { payoutPerConversion: "desc" };
      if (sortBy === "epc") orderBy = { payoutPerConversion: "desc" }; // Approximate EPC by payout

      const [campaigns, total] = await Promise.all([
        ctx.db.campaign.findMany({
          where,
          include: {
            brand: {
              select: { companyName: true, logo: true, industry: true },
            },
            _count: {
              select: {
                applications: { where: { status: "APPROVED" } },
              },
            },
          },
          orderBy,
          skip,
          take: limit,
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

  /** Get campaign details by slug (public) */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { slug: input.slug },
        include: {
          brand: {
            select: {
              companyName: true,
              logo: true,
              industry: true,
              website: true,
              description: true,
            },
          },
          materials: true,
          _count: {
            select: {
              applications: { where: { status: "APPROVED" } },
              conversions: { where: { status: "APPROVED" } },
            },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return campaign;
    }),

  /** Get campaign by ID */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        include: {
          brand: {
            select: {
              companyName: true,
              logo: true,
              industry: true,
              website: true,
            },
          },
          materials: true,
          _count: {
            select: {
              applications: { where: { status: "APPROVED" } },
              conversions: { where: { status: "APPROVED" } },
            },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      return campaign;
    }),

  // ==========================================
  // BRAND — Campaign Management
  // ==========================================

  /** Create a new campaign */
  create: brandProcedure
    .input(campaignInput)
    .mutation(async ({ ctx, input }) => {
      const brand = await ctx.db.brand.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!brand || brand.status !== "ACTIVE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your brand must be verified before creating campaigns",
        });
      }

      // Generate unique slug
      let slug = slugify(input.name);
      const existing = await ctx.db.campaign.findUnique({ where: { slug } });
      if (existing) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const campaign = await ctx.db.campaign.create({
        data: {
          brandId: brand.id,
          name: input.name,
          slug,
          description: input.description,
          shortDescription: input.shortDescription,
          landingUrl: input.landingUrl,
          imageUrl: input.imageUrl,
          conversionType: input.conversionType,
          payoutPerConversion: input.payoutPerConversion,
          platformFee: 0.20, // 20%
          categories: input.categories,
          countries: input.countries,
          minFollowers: input.minFollowers,
          minAvgViewers: input.minAvgViewers,
          totalBudget: input.totalBudget,
          dailyBudget: input.dailyBudget,
          remainingBudget: input.totalBudget,
          approvalMode: input.approvalMode,
          maxStreamers: input.maxStreamers,
          attributionWindow: input.attributionWindow,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          status: "DRAFT",
        },
      });

      return campaign;
    }),

  /** Update a campaign */
  update: brandProcedure
    .input(
      z.object({
        id: z.string(),
        data: campaignInput.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const campaign = await ctx.db.campaign.findFirst({
        where: {
          id: input.id,
          brand: { userId: ctx.session.user.id },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db.campaign.update({
        where: { id: input.id },
        data: {
          ...input.data,
          startDate: input.data.startDate ? new Date(input.data.startDate) : undefined,
          endDate: input.data.endDate ? new Date(input.data.endDate) : undefined,
        },
      });
    }),

  /** Activate/Pause/Cancel a campaign */
  updateStatus: brandProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findFirst({
        where: {
          id: input.id,
          brand: { userId: ctx.session.user.id },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Validate transitions
      if (input.status === "ACTIVE" && campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot activate from current status" });
      }

      return ctx.db.campaign.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  /** List brand's own campaigns */
  listMyCampaigns: brandProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const brand = await ctx.db.brand.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!brand) throw new TRPCError({ code: "NOT_FOUND" });

      const where: any = { brandId: brand.id };
      if (input?.status) where.status = input.status;

      return ctx.db.campaign.findMany({
        where,
        include: {
          _count: {
            select: {
              applications: { where: { status: "APPROVED" } },
              clicks: true,
              conversions: { where: { status: "APPROVED" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /** Get campaign with applicants (for brand review) */
  getWithApplicants: brandProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findFirst({
        where: {
          id: input.id,
          brand: { userId: ctx.session.user.id },
        },
        include: {
          applications: {
            include: {
              streamer: {
                select: {
                  id: true,
                  twitchDisplayName: true,
                  twitchAvatar: true,
                  twitchFollowers: true,
                  avgViewers: true,
                  streamerScore: true,
                  country: true,
                  categories: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: { clicks: true, conversions: true },
          },
        },
      });

      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return campaign;
    }),

  // ==========================================
  // STREAMER — Applications
  // ==========================================

  /** Apply to a campaign */
  apply: streamerProcedure
    .input(
      z.object({
        campaignId: z.string(),
        message: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!streamer || streamer.status !== "ACTIVE") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Complete onboarding before applying to campaigns",
        });
      }

      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign || campaign.status !== "ACTIVE") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not available" });
      }

      // Check requirements
      if (campaign.minFollowers > 0 && streamer.twitchFollowers < campaign.minFollowers) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This campaign requires at least ${campaign.minFollowers} followers`,
        });
      }

      if (campaign.minAvgViewers > 0 && streamer.avgViewers < campaign.minAvgViewers) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This campaign requires at least ${campaign.minAvgViewers} average viewers`,
        });
      }

      // Check if already applied
      const existing = await ctx.db.campaignApplication.findUnique({
        where: {
          campaignId_streamerId: {
            campaignId: input.campaignId,
            streamerId: streamer.id,
          },
        },
      });

      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "You already applied to this campaign" });
      }

      // Check max streamers
      if (campaign.maxStreamers) {
        const approvedCount = await ctx.db.campaignApplication.count({
          where: {
            campaignId: input.campaignId,
            status: "APPROVED",
          },
        });
        if (approvedCount >= campaign.maxStreamers) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This campaign has reached its maximum number of streamers",
          });
        }
      }

      // Create application
      const status = campaign.approvalMode === "AUTO" ? "APPROVED" : "PENDING";

      const application = await ctx.db.campaignApplication.create({
        data: {
          campaignId: input.campaignId,
          streamerId: streamer.id,
          status,
          message: input.message,
        },
      });

      return { application, autoApproved: status === "APPROVED" };
    }),

  /** Approve/reject a streamer application (brand) */
  reviewApplication: brandProcedure
    .input(
      z.object({
        applicationId: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.campaignApplication.findFirst({
        where: {
          id: input.applicationId,
          campaign: { brand: { userId: ctx.session.user.id } },
        },
      });

      if (!application) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db.campaignApplication.update({
        where: { id: input.applicationId },
        data: {
          status: input.status,
          reviewNote: input.note,
          reviewedAt: new Date(),
        },
      });
    }),

  /** List streamer's active offers (campaigns they've been accepted to) */
  listMyOffers: streamerProcedure.query(async ({ ctx }) => {
    const streamer = await ctx.db.streamer.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!streamer) throw new TRPCError({ code: "NOT_FOUND" });

    return ctx.db.campaignApplication.findMany({
      where: {
        streamerId: streamer.id,
      },
      include: {
        campaign: {
          include: {
            brand: { select: { companyName: true, logo: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  /** Check if streamer has applied to a campaign */
  getMyApplication: streamerProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const streamer = await ctx.db.streamer.findUnique({
        where: { userId: ctx.session.user.id },
      });

      if (!streamer) return null;

      return ctx.db.campaignApplication.findUnique({
        where: {
          campaignId_streamerId: {
            campaignId: input.campaignId,
            streamerId: streamer.id,
          },
        },
      });
    }),

  /** Get unique categories from active campaigns (for filter UI) */
  getCategories: publicProcedure.query(async ({ ctx }) => {
    const campaigns = await ctx.db.campaign.findMany({
      where: { status: "ACTIVE" },
      select: { categories: true },
    });

    const allCategories = campaigns.flatMap((c) => c.categories);
    return [...new Set(allCategories)].sort();
  }),

  // ============================================================
  // NEW ENDPOINTS — added for /brand/campaigns/[id], /streamer/links,
  // /streamer/earnings, /brand/applications pages
  // ============================================================

  /** Full campaign detail for brand owner — metrics, applications, streamers */
  getCampaignDetail: brandProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findFirst({
        where: {
          id: input.id,
          brandId: ctx.session.user.brandId,
        },
        include: {
          materials: true,
          applications: {
            include: {
              streamer: {
                select: {
                  id: true,
                  twitchDisplayName: true,
                  twitchUsername: true,
                  twitchAvatar: true,
                  twitchFollowers: true,
                  avgViewers: true,
                  streamerScore: true,
                  country: true,
                },
              },
              affiliateLink: {
                select: {
                  slug: true,
                  totalClicks: true,
                  totalConversions: true,
                  totalEarnings: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });

      // Calculate aggregated metrics
      const metrics = await ctx.db.affiliateLink.aggregate({
        where: { campaignId: campaign.id },
        _sum: {
          totalClicks: true,
          totalConversions: true,
          totalEarnings: true,
        },
      });

      return {
        ...campaign,
        totalClicks: metrics._sum.totalClicks || 0,
        totalConversions: metrics._sum.totalConversions || 0,
        spent: metrics._sum.totalEarnings || 0,
      };
    }),

  /** Get all affiliate links for the current streamer with analytics */
  getMyLinks: streamerProcedure.query(async ({ ctx }) => {
    const links = await ctx.db.affiliateLink.findMany({
      where: { streamerId: ctx.session.user.streamerId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            slug: true,
            payoutPerConversion: true,
            conversionType: true,
            status: true,
            brand: {
              select: {
                companyName: true,
                logo: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return links.map((link) => ({
      ...link,
      conversionRate:
        link.totalClicks > 0
          ? (link.totalConversions / link.totalClicks) * 100
          : 0,
    }));
  }),

  /** Toggle affiliate link active/inactive */
  toggleLink: streamerProcedure
    .input(
      z.object({
        linkId: z.string(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.affiliateLink.findFirst({
        where: {
          id: input.linkId,
          streamerId: ctx.session.user.streamerId,
        },
      });

      if (!link) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.affiliateLink.update({
        where: { id: input.linkId },
        data: { isActive: input.isActive },
      });
    }),

  /** Get conversion history for current streamer */
  getMyConversions: streamerProcedure.query(async ({ ctx }) => {
    return ctx.db.conversion.findMany({
      where: { streamerId: ctx.session.user.streamerId },
      select: {
        id: true,
        status: true,
        payout: true,
        fraudScore: true,
        conversionType: true,
        createdAt: true,
        campaign: {
          select: {
            name: true,
            brand: {
              select: { companyName: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }),

  /** Get all applications across all brand campaigns (for /brand/applications) */
  getAllApplications: brandProcedure.query(async ({ ctx }) => {
    return ctx.db.application.findMany({
      where: {
        campaign: { brandId: ctx.session.user.brandId },
      },
      include: {
        campaign: {
          select: { id: true, name: true },
        },
        streamer: {
          select: {
            id: true,
            twitchDisplayName: true,
            twitchUsername: true,
            twitchAvatar: true,
            twitchFollowers: true,
            avgViewers: true,
            streamerScore: true,
            country: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});
