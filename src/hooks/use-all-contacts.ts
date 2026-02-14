"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ContactsPageResponse, ContactFilters } from "@/types/contact";

interface UseAllContactsParams extends ContactFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export function useAllContacts(params: UseAllContactsParams) {
  return useQuery<ContactsPageResponse>({
    queryKey: ["all-contacts", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
      if (params.sortBy) searchParams.set("sortBy", params.sortBy);
      if (params.sortDir) searchParams.set("sortDir", params.sortDir);
      if (params.search) searchParams.set("search", params.search);
      if (params.interestLevel) searchParams.set("interestLevel", params.interestLevel);
      if (params.outreachStatus) searchParams.set("outreachStatus", params.outreachStatus);
      if (params.sentiment) searchParams.set("sentiment", params.sentiment);
      if (params.dealStage) searchParams.set("dealStage", params.dealStage);
      if (params.overdueOnly) searchParams.set("overdueOnly", "true");

      const res = await fetch(`/api/contacts?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
  });
}

export function useUpdateContactGlobal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opportunityId,
      contactId,
      data,
    }: {
      opportunityId: string;
      contactId: string;
      data: Record<string, unknown>;
    }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/contacts?contactId=${contactId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Failed to update contact");
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Contact updated");
      queryClient.invalidateQueries({ queryKey: ["all-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts", variables.opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
    onError: () => {
      toast.error("Failed to update contact");
    },
  });
}
