"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  listingId: string | null;
  listing: { id: string; title: string } | null;
  priority: string | null;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}

interface UseNotificationsParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export function useNotifications(params: UseNotificationsParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.unreadOnly) searchParams.set("unreadOnly", "true");
  if (params.page) searchParams.set("page", String(params.page));
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));

  return useQuery<NotificationsResponse>({
    queryKey: ["notifications", params],
    queryFn: async () => {
      const res = await fetch(`/api/notifications?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });
}

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unreadOnly=true&limit=0");
      if (!res.ok) throw new Error("Failed to fetch unread count");
      const data: NotificationsResponse = await res.json();
      return data.unreadCount;
    },
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { ids: string[] } | { markAllRead: true }) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to mark notifications as read");
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
