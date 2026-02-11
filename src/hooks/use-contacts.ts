"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Contact {
  id: string;
  opportunityId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  interestLevel: "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  isPrimary: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Thesis fields
  linkedinUrl: string | null;
  estimatedAgeRange: string | null;
  yearsInIndustry: number | null;
  yearsAtCompany: number | null;
  foundedCompany: boolean | null;
  ownershipPct: number | null;
  hasPartner: boolean | null;
  partnerName: string | null;
  hasSuccessor: boolean | null;
  successorName: string | null;
  familyBusiness: boolean | null;
  education: string | null;
  priorEmployers: string[];
  outreachStatus: string | null;
  sentiment: string | null;
  nextFollowUpDate: string | null;
}

interface ContactsResponse {
  contacts: Contact[];
}

export function useContacts(opportunityId: string | null) {
  return useQuery<ContactsResponse>({
    queryKey: ["contacts", opportunityId],
    queryFn: async () => {
      if (!opportunityId) return { contacts: [] };
      const res = await fetch(`/api/pipeline/${opportunityId}/contacts`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!opportunityId,
  });
}

export function useAddContact(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      email?: string;
      phone?: string;
      company?: string;
      role?: string;
      interestLevel?: string;
      isPrimary?: boolean;
      notes?: string;
    }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add contact");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contact added");
      queryClient.invalidateQueries({ queryKey: ["contacts", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: () => {
      toast.error("Failed to add contact");
    },
  });
}

export function useUpdateContact(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      data,
    }: {
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
    onSuccess: () => {
      toast.success("Contact updated");
      queryClient.invalidateQueries({ queryKey: ["contacts", opportunityId] });
    },
    onError: () => {
      toast.error("Failed to update contact");
    },
  });
}

export function useDeleteContact(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/contacts?contactId=${contactId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete contact");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Contact deleted");
      queryClient.invalidateQueries({ queryKey: ["contacts", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
    },
    onError: () => {
      toast.error("Failed to delete contact");
    },
  });
}
