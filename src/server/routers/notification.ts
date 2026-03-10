/**
 * Notification router — in-app notifications CRUD
 * Covers: list, mark read, mark all read, count unread, create (internal)
 */
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";

export const notificationRouter = createTRPCRouter({
  // ==========================================
  // USER — Read notifications
  // ==========================================

  /** List notifications for the current user (paginated) */
  list: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(50).default(20),
          unreadOnly: z.boolean().default(false),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page || 1;
      const limit = input?.limit || 20;
      const userId = ctx.session.user.id;

      const where: any = { userId };
      if (input?.unreadOnly) {
        where.readAt = null;
      }

      const [notifications, total] = await Promise.all([
        ctx.db.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        ctx.db.notification.count({ where }),
      ]);

      return {
        notifications,
        total,
        pages: Math.ceil(total / limit),
        page,
      };
    }),

  /** Count unread notifications */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: {
        userId: ctx.session.user.id,
        readAt: null,
      },
    });
    return { count };
  }),

  /** Mark a single notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.notification.findUnique({
        where: { id: input.id },
      });

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (notification.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return ctx.db.notification.update({
        where: { id: input.id },
        data: { readAt: new Date() },
      });
    }),

  /** Mark all notifications as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.db.notification.updateMany({
      where: {
        userId: ctx.session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }),

  /** Delete a notification */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const notification = await ctx.db.notification.findUnique({
        where: { id: input.id },
      });

      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (notification.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.notification.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ==========================================
  // INTERNAL — Create notifications (called by other routers)
  // ==========================================

  /**
   * Create a notification for a user.
   * Types: CONVERSION, PAYOUT, APPLICATION, CAMPAIGN, SYSTEM
   * This is an admin-only procedure used internally by the platform.
   */
  create: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        type: z.enum([
          "CONVERSION",
          "PAYOUT",
          "APPLICATION",
          "CAMPAIGN",
          "SYSTEM",
        ]),
        title: z.string().max(200),
        message: z.string().max(1000),
        link: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          link: input.link,
          metadata: input.metadata || {},
        },
      });
    }),

  /** Bulk-create notifications (e.g., campaign status change to all applicants) */
  createBulk: adminProcedure
    .input(
      z.object({
        userIds: z.array(z.string()).min(1).max(500),
        type: z.enum([
          "CONVERSION",
          "PAYOUT",
          "APPLICATION",
          "CAMPAIGN",
          "SYSTEM",
        ]),
        title: z.string().max(200),
        message: z.string().max(1000),
        link: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = input.userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        metadata: {},
      }));

      const result = await ctx.db.notification.createMany({ data });
      return { created: result.count };
    }),
});

// ==========================================
// HELPER — Create notification without tRPC context
// ==========================================

import { db } from "@/lib/db";

type NotificationType =
  | "CONVERSION"
  | "PAYOUT"
  | "APPLICATION"
  | "CAMPAIGN"
  | "SYSTEM";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Standalone helper to create a notification from anywhere in the codebase
 * (e.g., from webhook handlers, cron jobs, or other routers).
 *
 * Usage:
 *   import { createNotification } from "@/server/routers/notification";
 *   await createNotification({
 *     userId: "...",
 *     type: "CONVERSION",
 *     title: "New conversion!",
 *     message: "You earned $5.00 from Campaign X",
 *     link: "/streamer",
 *   });
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    return await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: params.metadata || {},
      },
    });
  } catch (error) {
    console.error("[Notification] Failed to create:", error);
    return null;
  }
}

/**
 * Standalone helper to notify multiple users at once.
 */
export async function createBulkNotifications(
  userIds: string[],
  notification: Omit<CreateNotificationParams, "userId">,
) {
  try {
    const data = userIds.map((userId) => ({
      userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      metadata: notification.metadata || {},
    }));

    const result = await db.notification.createMany({ data });
    return result.count;
  } catch (error) {
    console.error("[Notification] Bulk create failed:", error);
    return 0;
  }
}
