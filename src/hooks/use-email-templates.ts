"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  category: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplatesResponse {
  templates: EmailTemplate[];
}

interface GenerateResult {
  subject: string;
  bodyHtml: string;
}

// ─────────────────────────────────────────────
// Query: List templates
// ─────────────────────────────────────────────

export function useEmailTemplates() {
  return useQuery<TemplatesResponse>({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/email/templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Create template
// ─────────────────────────────────────────────

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      subject: string;
      bodyHtml: string;
      category?: string;
    }) => {
      const res = await fetch("/api/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Template created");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: () => {
      toast.error("Failed to create template");
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Update template
// ─────────────────────────────────────────────

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ name: string; subject: string; bodyHtml: string; category: string }>;
    }) => {
      const res = await fetch(`/api/email/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Template updated");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: () => {
      toast.error("Failed to update template");
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Delete template
// ─────────────────────────────────────────────

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/email/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: () => {
      toast.error("Failed to delete template");
    },
  });
}

// ─────────────────────────────────────────────
// Mutation: Generate template with AI
// ─────────────────────────────────────────────

export function useGenerateTemplate() {
  return useMutation<GenerateResult, Error, { category: string; context?: string }>({
    mutationFn: async (params) => {
      const res = await fetch("/api/email/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to generate template");
      return res.json();
    },
    onError: () => {
      toast.error("Failed to generate template with AI");
    },
  });
}
