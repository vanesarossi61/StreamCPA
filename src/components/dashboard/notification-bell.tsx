"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ==========================================
// Types
// ==========================================

interface Notification {
  id: string;
  type: "CONVERSION" | "PAYOUT" | "APPLICATION" | "CAMPAIGN" | "SYSTEM";
  title: string;
  message: string;
  link?: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  /** Initial unread count */
  initialCount?: number;
  /** Fetch notifications (paginated) */
  onFetch: (page: number) => Promise<{
    notifications: Notification[];
    total: number;
    pages: number;
  }>;
  /** Mark single as read */
  onMarkRead: (id: string) => Promise<void>;
  /** Mark all as read */
  onMarkAllRead: () => Promise<void>;
  /** SSE endpoint for real-time updates */
  sseUrl?: string;
  /** Navigate to link */
  onNavigate?: (link: string) => void;
  className?: string;
}

// ==========================================
// NotificationBell
// ==========================================

export function NotificationBell({
  initialCount = 0,
  onFetch,
  onMarkRead,
  onMarkAllRead,
  sseUrl = "/api/notifications/sse",
  onNavigate,
  className,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    if (!sseUrl) return;

    const connect = () => {
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.addEventListener("notification", (event) => {
        try {
          const data = JSON.parse(event.data) as Notification;
          setNotifications((prev) => [data, ...prev]);
          setUnreadCount((c) => c + 1);
        } catch {
          // ignore parse errors
        }
      });

      es.addEventListener("count", (event) => {
        try {
          const data = JSON.parse(event.data);
          setUnreadCount(data.count);
        } catch {
          // ignore
        }
      });

      es.onerror = () => {
        es.close();
        // Reconnect after 5s
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => eventSourceRef.current?.close();
  }, [sseUrl]);

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const result = await onFetch(pageNum);
      if (pageNum === 1) {
        setNotifications(result.notifications);
      } else {
        setNotifications((prev) => [...prev, ...result.notifications]);
      }
      setHasMore(pageNum < result.pages);
    } finally {
      setLoading(false);
    }
  }, [onFetch]);

  const handleOpen = () => {
    setOpen((prev) => {
      if (!prev) {
        setPage(1);
        fetchNotifications(1);
      }
      return !prev;
    });
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  };

  const handleMarkRead = async (notification: Notification) => {
    if (!notification.readAt) {
      await onMarkRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notification.link && onNavigate) {
      onNavigate(notification.link);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await onMarkAllRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-md hover:bg-muted transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <svg
          className="w-5 h-5 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-background rounded-lg border shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && !loading ? (
              <div className="py-12 text-center">
                <svg
                  className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <>
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onClick={() => handleMarkRead(n)}
                  />
                ))}
                {hasMore && (
                  <div className="p-2 text-center border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
              </>
            )}
            {loading && notifications.length === 0 && (
              <div className="space-y-0">
                {Array.from({ length: 3 }).map((_, i) => (
                  <NotificationSkeleton key={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// NotificationItem
// ==========================================

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const isUnread = !notification.readAt;
  const icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM;
  const timeAgo = getTimeAgo(notification.createdAt);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0",
        isUnread && "bg-primary/5"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          icon.bg
        )}
      >
        <span className="text-sm">{icon.emoji}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm line-clamp-1", isUnread && "font-medium")}>
            {notification.title}
          </p>
          {isUnread && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}

// ==========================================
// Skeleton
// ==========================================

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b">
      <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-3 w-48 bg-muted animate-pulse rounded" />
        <div className="h-2.5 w-16 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}

// ==========================================
// Constants & Helpers
// ==========================================

const NOTIFICATION_ICONS: Record<string, { emoji: string; bg: string }> = {
  CONVERSION: { emoji: "$", bg: "bg-emerald-500/10 text-emerald-600" },
  PAYOUT: { emoji: "B", bg: "bg-blue-500/10 text-blue-600" },
  APPLICATION: { emoji: "U", bg: "bg-purple-500/10 text-purple-600" },
  CAMPAIGN: { emoji: "C", bg: "bg-amber-500/10 text-amber-600" },
  SYSTEM: { emoji: "i", bg: "bg-gray-500/10 text-gray-600" },
};

function getTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
