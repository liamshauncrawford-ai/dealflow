"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bell,
  Plus,
  AlertTriangle,
  XCircle,
  Layers,
  RefreshCw,
  Trash2,
  Mail,
} from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  type Notification,
} from "@/hooks/use-notifications";

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  NEW_LISTING: Plus,
  COOKIE_EXPIRED: AlertTriangle,
  SCRAPE_FAILED: XCircle,
  DEDUP_CANDIDATE: Layers,
  LISTING_UPDATED: RefreshCw,
  LISTING_REMOVED: Trash2,
  EMAIL_RECEIVED: Mail,
};

function getNotificationIcon(type: string) {
  return notificationIcons[type] || Bell;
}

function getIconColor(type: string): string {
  switch (type) {
    case "NEW_LISTING":
      return "text-emerald-500 bg-emerald-500/10";
    case "COOKIE_EXPIRED":
    case "SCRAPE_FAILED":
      return "text-destructive bg-destructive/10";
    case "DEDUP_CANDIDATE":
      return "text-amber-500 bg-amber-500/10";
    case "LISTING_UPDATED":
      return "text-blue-500 bg-blue-500/10";
    case "LISTING_REMOVED":
      return "text-muted-foreground bg-muted";
    case "EMAIL_RECEIVED":
      return "text-violet-500 bg-violet-500/10";
    default:
      return "text-muted-foreground bg-muted";
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: notificationsData } = useNotifications({ limit: 8 });
  const markRead = useMarkRead();

  const notifications = notificationsData?.notifications ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleToggle() {
    setIsOpen((prev) => !prev);
  }

  function handleMarkAllRead() {
    markRead.mutate({ markAllRead: true });
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markRead.mutate({ ids: [notification.id] });
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          isOpen && "bg-muted text-foreground"
        )}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markRead.isPending}
                className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[28rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No notifications yet
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  const iconColor = getIconColor(notification.type);

                  return (
                    <li key={notification.id}>
                      <button
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                          !notification.isRead && "bg-primary/[0.03]"
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            iconColor
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "truncate text-sm",
                                notification.isRead
                                  ? "text-foreground"
                                  : "font-medium text-foreground"
                              )}
                            >
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground/60">
                            {formatRelativeDate(notification.createdAt)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full text-center text-xs font-medium text-primary hover:text-primary/80"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
