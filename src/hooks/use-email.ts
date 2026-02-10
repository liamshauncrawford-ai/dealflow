"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  email: string;
  displayName: string | null;
  provider: "MICROSOFT" | "GMAIL";
  isConnected: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

interface EmailAccountsResponse {
  accounts: EmailAccount[];
}

interface SyncResult {
  synced: {
    emailsSynced: number;
  };
  linked: {
    emailsLinked: number;
  };
}

interface EmailLink {
  id: string;
  emailId: string;
  opportunityId: string;
  linkedBy: string;
  opportunity: {
    id: string;
    title: string;
  };
}

interface EmailMessage {
  id: string;
  externalMessageId: string;
  subject: string | null;
  bodyPreview: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  sentAt: string | null;
  receivedAt: string | null;
  conversationId: string | null;
  isRead: boolean;
  hasAttachments: boolean;
  importance: string | null;
  webLink: string | null;
  createdAt: string;
  links: EmailLink[];
}

interface EmailMessagesResponse {
  emails: EmailMessage[];
  total: number;
  page: number;
  totalPages: number;
}

interface EmailMessagesParams {
  opportunityId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useEmailAccounts() {
  return useQuery<EmailAccountsResponse>({
    queryKey: ["email-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/email");
      if (!res.ok) throw new Error("Failed to fetch email accounts");
      return res.json();
    },
  });
}

export function useSyncEmails() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult, Error, { accountId: string }>({
    mutationFn: async ({ accountId }) => {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) throw new Error("Failed to sync emails");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Emails synced successfully");
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["email-messages"] });
      // Listing alerts may have created new listings
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: () => {
      toast.error("Failed to sync emails");
    },
  });
}

export function useDisconnectEmail() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, { accountId: string }>({
    mutationFn: async ({ accountId }) => {
      const res = await fetch("/api/email", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) throw new Error("Failed to disconnect email");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Email disconnected");
      queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
    },
    onError: () => {
      toast.error("Failed to disconnect email");
    },
  });
}

interface EmailConfigResponse {
  gmail: boolean;
  microsoft: boolean;
  anyConfigured: boolean;
}

export function useEmailConfig() {
  return useQuery<EmailConfigResponse>({
    queryKey: ["email-config"],
    queryFn: async () => {
      const res = await fetch("/api/email/config-check");
      if (!res.ok) throw new Error("Failed to fetch email config");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useEmailMessages(params?: EmailMessagesParams) {
  const searchParams = new URLSearchParams();
  if (params?.opportunityId) searchParams.set("opportunityId", params.opportunityId);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));

  return useQuery<EmailMessagesResponse>({
    queryKey: ["email-messages", params],
    queryFn: async () => {
      const res = await fetch(`/api/email/messages?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch email messages");
      return res.json();
    },
  });
}
