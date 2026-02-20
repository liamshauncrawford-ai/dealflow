"use client";

import { useState } from "react";
import { Copy, Check, Mail, Loader2, RefreshCw } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { OutreachResult } from "@/lib/ai/outreach-draft";

interface OutreachDraftPanelProps {
  draft: OutreachResult | null;
  createdAt?: string;
  isLoading: boolean;
  onGenerate: () => void;
}

export function OutreachDraftPanel({
  draft,
  createdAt,
  isLoading,
  onGenerate,
}: OutreachDraftPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm">Generating personalized outreach draft...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Outreach Draft</span>
          {createdAt && (
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(createdAt)}
            </span>
          )}
        </div>
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Subject line */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">
              Subject Line
            </label>
            <CopyButton
              onClick={() => copyToClipboard(draft.subject, "subject")}
              copied={copiedField === "subject"}
            />
          </div>
          <p className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium">
            {draft.subject}
          </p>
        </div>

        {/* Body */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">
              Letter Body
            </label>
            <CopyButton
              onClick={() => copyToClipboard(draft.body, "body")}
              copied={copiedField === "body"}
            />
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed whitespace-pre-line">
            {draft.body}
          </div>
        </div>

        {/* Approach notes */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <span className="font-medium">Approach:</span>{" "}
            {draft.approach_notes}
          </p>
          <p>
            <span className="font-medium">Follow-up:</span>{" "}
            {draft.follow_up_timing}
          </p>
          {draft.alternative_channels.length > 0 && (
            <p>
              <span className="font-medium">Alt. Channels:</span>{" "}
              {draft.alternative_channels.join(", ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CopyButton({
  onClick,
  copied,
}: {
  onClick: () => void;
  copied: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}
