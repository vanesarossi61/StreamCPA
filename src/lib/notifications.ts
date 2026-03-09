/**
 * Notifications — In-app notification system for StreamCPA
 *
 * CRUD for notifications + real-time delivery via SSE (Server-Sent Events).
 * Integrates with Inngest for async email notifications.
 *
 * Notification types: CONVERSION, PAYOUT, APPLICATION, CAMPAIGN, SYSTEM
 */
import { db } from "@/lib/db";

// ==========================================
// TYPES
// ==========================================

export interface NotificationPayload {
  userId: string;
  type: "CONVERSION" | "PAYOUT" | "APPLICATION" | "CAMPAIGN" | "SYSTEM";
  title: string;
  message: string;
  link?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
}

// ==========================================
// CRUD OPERATIONS
// ==========================================

/**
 * Create a new notification for a user
 */
export async function createNotification(
  payload: NotificationPayload,
): Promise<NotificationItem> {
  const notification = await db.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link || null,
    },
  });

  // Emit to SSE listeners
  emitNotification(payload.userId, notification);

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

/**
 * Get notifications for a user (paginated)
 */
export async function getNotifications(
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
): Promise<{ notifications: NotificationItem[]; total: number; unread: number }> {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const where: any = { userId };
  if (unreadOnly) where.read = false;

  const [notifications, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        read: true,
        createdAt: true,
      },
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, read: false } }),
  ]);

  return { notifications, total, unread };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, read: false },
  });
}

/**
 * Mark a single notification as read
 */
export async function markRead(notificationId: string, userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return result.count;
}

/**
 * Delete old notifications (cleanup job)
 */
export async function deleteOldNotifications(
  daysOld: number = 90,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await db.notification.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      read: true, // Only delete read notifications
    },
  });
  return result.count;
}

// ==========================================
// SERVER-SENT EVENTS (SSE)
// ==========================================

/**
 * In-memory store of active SSE connections.
 * In production with multiple instances, use Redis Pub/Sub instead.
 */
const sseConnections = new Map<string, Set<ReadableStreamDefaultController>>();

/**
 * Subscribe a user to real-time notifications via SSE.
 * Returns a ReadableStream for the Response body.
 *
 * Usage in API route:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const userId = session.user.id;
 *   const stream = subscribeToNotifications(userId);
 *   return new Response(stream, {
 *     headers: {
 *       'Content-Type': 'text/event-stream',
 *       'Cache-Control': 'no-cache',
 *       'Connection': 'keep-alive',
 *     },
 *   });
 * }
 * ```
 */
export function subscribeToNotifications(
  userId: string,
): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // Register this connection
      if (!sseConnections.has(userId)) {
        sseConnections.set(userId, new Set());
      }
      sseConnections.get(userId)!.add(controller);

      // Send initial keepalive
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30_000);

      // Cleanup on close
      return () => {
        clearInterval(keepalive);
        sseConnections.get(userId)?.delete(controller);
        if (sseConnections.get(userId)?.size === 0) {
          sseConnections.delete(userId);
        }
      };
    },
    cancel() {
      // Connection closed by client
    },
  });
}

/**
 * Emit a notification to all active SSE connections for a user
 */
function emitNotification(userId: string, notification: any): void {
  const connections = sseConnections.get(userId);
  if (!connections || connections.size === 0) return;

  const encoder = new TextEncoder();
  const data = JSON.stringify({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    link: notification.link,
    createdAt: notification.createdAt,
  });

  const message = encoder.encode(`event: notification\ndata: ${data}\n\n`);

  for (const controller of connections) {
    try {
      controller.enqueue(message);
    } catch {
      // Connection dead — remove it
      connections.delete(controller);
    }
  }
}

/**
 * Get count of active SSE connections (for monitoring)
 */
export function getActiveConnectionCount(): number {
  let total = 0;
  for (const connections of sseConnections.values()) {
    total += connections.size;
  }
  return total;
}
