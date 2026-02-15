"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SendEmailParams {
  emailAccountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  opportunityId?: string;
  inReplyToExternalId?: string;
  conversationId?: string;
}

interface SendEmailResult {
  success: boolean;
  email: {
    id: string;
    externalMessageId: string;
    subject: string | null;
  };
}

export function useSendEmail(opportunityId?: string) {
  const queryClient = useQueryClient();

  return useMutation<SendEmailResult, Error, SendEmailParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send email");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Email sent successfully");
      // Refresh the pipeline data so the new sent email shows up in linked emails
      if (opportunityId) {
        queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
        queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send email");
    },
  });
}
