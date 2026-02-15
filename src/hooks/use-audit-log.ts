"use client";

import { useQuery } from "@tanstack/react-query";

interface AuditLogEntry {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  opportunityId: string | null;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  summary: string;
  actorType: string;
  createdAt: string;
  opportunity: {
    id: string;
    title: string;
  } | null;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuditLogFilters {
  page?: number;
  limit?: number;
  opportunityId?: string;
  entityType?: string;
  eventType?: string;
}

export function useAuditLog(filters?: AuditLogFilters) {
  return useQuery<AuditLogResponse>({
    queryKey: ["audit-log", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.limit) params.set("limit", String(filters.limit));
      if (filters?.opportunityId) params.set("opportunityId", filters.opportunityId);
      if (filters?.entityType) params.set("entityType", filters.entityType);
      if (filters?.eventType) params.set("eventType", filters.eventType);

      const qs = params.toString();
      const res = await fetch(`/api/audit${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });
}
