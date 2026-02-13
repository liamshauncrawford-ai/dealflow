"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Upload a document
// ---------------------------------------------------------------------------

export function useUploadDocument(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      file: File;
      category: string;
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      formData.append("category", data.category);
      if (data.description) formData.append("description", data.description);

      const res = await fetch(`/api/pipeline/${opportunityId}/documents`, {
        method: "POST",
        body: formData,
        // NOTE: Do NOT set Content-Type — browser sets it with multipart boundary
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to upload document");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      queryClient.invalidateQueries({
        queryKey: ["opportunity", opportunityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to upload document");
    },
  });
}

// ---------------------------------------------------------------------------
// Delete a document
// ---------------------------------------------------------------------------

export function useDeleteDocument(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/documents?documentId=${documentId}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete document");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({
        queryKey: ["opportunity", opportunityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete document");
    },
  });
}

// ---------------------------------------------------------------------------
// Update document metadata (category, description)
// ---------------------------------------------------------------------------

export function useUpdateDocument(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      data,
    }: {
      documentId: string;
      data: { category?: string; description?: string | null };
    }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/documents?documentId=${documentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update document");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Document updated");
      queryClient.invalidateQueries({
        queryKey: ["opportunity", opportunityId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update document");
    },
  });
}
