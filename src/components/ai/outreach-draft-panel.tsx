"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Mail, Loader2, RefreshCw, Send, Calendar } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import type { OutreachResult } from "@/lib/ai/outreach-draft";
import type { OutreachTemplateType } from "@/lib/ai/outreach-draft";

// ─────────────────────────────────────────────
// Template selector config
// ─────────────────────────────────────────────

const TEMPLATES = [
  { type: "direct_owner" as const, label: "Direct Owner", icon: "\u{1F464}", desc: "Warm outreach to unlisted business owner" },
  { type: "broker_listed" as const, label: "Broker Response", icon: "\u{1F4BC}", desc: "Professional inquiry for listed business" },
  { type: "cpa_referral" as const, label: "CPA Referral", icon: "\u{1F3E2}", desc: "Request introductions from advisors" },
];

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────

interface ListingInfo {
  id: string;
  title?: string | null;
  businessName?: string | null;
  brokerName?: string | null;
  brokerCompany?: string | null;
  askingPrice?: string | number | null;
  targetRankLabel?: string | null;
}

interface OutreachDraftPanelProps {
  draft: OutreachResult | null;
  createdAt?: string;
  isLoading: boolean;
  onGenerate: (opts?: { templateType?: OutreachTemplateType; referralContactName?: string }) => void;
  listing?: ListingInfo | null;
}

export function OutreachDraftPanel({
  draft,
  createdAt,
  isLoading,
  onGenerate,
  listing,
}: OutreachDraftPanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<OutreachTemplateType>(
    listing?.brokerName ? "broker_listed" : "direct_owner"
  );
  const [referralContactName, setReferralContactName] = useState("");
  const [sentNotes, setSentNotes] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [markingSent, setMarkingSent] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Reset default template when listing changes
  useEffect(() => {
    setSelectedTemplate(listing?.brokerName ? "broker_listed" : "direct_owner");
  }, [listing?.brokerName]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerate = () => {
    onGenerate({
      templateType: selectedTemplate,
      referralContactName: selectedTemplate === "cpa_referral" ? referralContactName : undefined,
    });
  };

  const handleMarkAsSent = async () => {
    if (!listing?.id || !draft) return;
    setMarkingSent(true);
    setSentSuccess(false);
    try {
      const res = await fetch(`/api/listings/${listing.id}/outreach-sent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateType: selectedTemplate,
          subject: draft.subject,
          notes: sentNotes || undefined,
          nextActionDate: nextActionDate || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to mark as sent");
      }
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 3000);
    } catch (err) {
      console.error("Mark as sent error:", err);
      alert(err instanceof Error ? err.message : "Failed to mark as sent");
    } finally {
      setMarkingSent(false);
    }
  };

  // ─── Template Selector (always visible) ───

  const templateSelector = (
    <div className="space-y-3">
      <label className="text-xs font-medium text-muted-foreground">Outreach Template</label>
      <div className="grid grid-cols-3 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.type}
            onClick={() => setSelectedTemplate(t.type)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selectedTemplate === t.type
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="text-lg mb-1">{t.icon}</div>
            <div className="text-xs font-medium">{t.label}</div>
            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</div>
          </button>
        ))}
      </div>

      {selectedTemplate === "cpa_referral" && (
        <div>
          <label className="text-xs text-muted-foreground">Referral Contact Name</label>
          <input
            type="text"
            value={referralContactName}
            onChange={(e) => setReferralContactName(e.target.value)}
            placeholder="e.g. John Smith, CPA"
            className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {templateSelector}
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm">Generating personalized outreach draft...</p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-lg border bg-card p-6 space-y-4">
        {templateSelector}
        <button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Generate Draft
        </button>
      </div>
    );
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
          onClick={handleGenerate}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Template selector */}
        {templateSelector}

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

        {/* ─── Mark as Sent Section ─────────────────────────── */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() =>
                copyToClipboard(draft.subject + "\n\n" + draft.body, "full")
              }
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
            >
              {copiedField === "full" ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Follow-up Notes (optional)</label>
            <textarea
              value={sentNotes}
              onChange={(e) => setSentNotes(e.target.value)}
              placeholder="Any notes about this outreach..."
              rows={2}
              className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Next Follow-up Date (optional)
            </label>
            <input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="mt-1 rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>

          <button
            onClick={handleMarkAsSent}
            disabled={markingSent || !listing?.id}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {markingSent ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Marking...
              </>
            ) : sentSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Marked as Sent!
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Mark as Sent
              </>
            )}
          </button>
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
