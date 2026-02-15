"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEmailAccounts } from "@/hooks/use-email";
import { useSendEmail } from "@/hooks/use-email-send";
import { TemplateSelector } from "./template-selector";

interface ReplyTo {
  externalMessageId: string;
  conversationId: string | null;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
}

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  dealTitle: string;
  contacts: Array<{ name: string; email: string | null }>;
  replyTo?: ReplyTo | null;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  opportunityId,
  dealTitle,
  contacts,
  replyTo,
}: ComposeEmailModalProps) {
  const { data: accountsData } = useEmailAccounts();
  const sendMutation = useSendEmail(opportunityId);

  const accounts = accountsData?.accounts?.filter((a) => a.isConnected) ?? [];

  // Form state
  const [fromAccountId, setFromAccountId] = useState("");
  const [toInputs, setToInputs] = useState<string[]>([]);
  const [ccInputs, setCcInputs] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");

  // Initialize form when modal opens or replyTo changes
  useEffect(() => {
    if (!open) return;

    // Default from account
    if (accounts.length > 0 && !fromAccountId) {
      setFromAccountId(accounts[0].id);
    }

    if (replyTo) {
      // Reply mode
      setToInputs([replyTo.fromAddress]);
      setSubject(
        replyTo.subject
          ? replyTo.subject.startsWith("Re:")
            ? replyTo.subject
            : `Re: ${replyTo.subject}`
          : "Re: "
      );
      setBody("");
    } else {
      // New email mode — pre-populate with contacts that have emails
      const contactEmails = contacts
        .filter((c) => c.email)
        .map((c) => c.email as string);
      setToInputs(contactEmails.length > 0 ? contactEmails : []);
      setSubject("");
      setBody("");
    }

    setToInput("");
    setCcInput("");
    setCcInputs([]);
    setShowCc(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, replyTo]);

  // Set default account when accounts load
  useEffect(() => {
    if (accounts.length > 0 && !fromAccountId) {
      setFromAccountId(accounts[0].id);
    }
  }, [accounts, fromAccountId]);

  const addTo = useCallback(() => {
    const trimmed = toInput.trim();
    if (trimmed && !toInputs.includes(trimmed)) {
      setToInputs((prev) => [...prev, trimmed]);
    }
    setToInput("");
  }, [toInput, toInputs]);

  const addCc = useCallback(() => {
    const trimmed = ccInput.trim();
    if (trimmed && !ccInputs.includes(trimmed)) {
      setCcInputs((prev) => [...prev, trimmed]);
    }
    setCcInput("");
  }, [ccInput, ccInputs]);

  const removeTo = (email: string) => {
    setToInputs((prev) => prev.filter((e) => e !== email));
  };

  const removeCc = (email: string) => {
    setCcInputs((prev) => prev.filter((e) => e !== email));
  };

  const handleApplyTemplate = (templateSubject: string, templateBody: string) => {
    // Variable substitution
    const selectedAccount = accounts.find((a) => a.id === fromAccountId);
    const firstContact = contacts[0];

    let resolvedSubject = templateSubject;
    let resolvedBody = templateBody;

    const vars: Record<string, string> = {
      "{{contact_name}}": firstContact?.name || "there",
      "{{deal_title}}": dealTitle || "",
      "{{sender_name}}": selectedAccount?.displayName || "",
      "{{company_name}}": firstContact?.name || "",
    };

    for (const [key, value] of Object.entries(vars)) {
      resolvedSubject = resolvedSubject.replaceAll(key, value);
      resolvedBody = resolvedBody.replaceAll(key, value);
    }

    setSubject(resolvedSubject);
    setBody(stripHtmlToPlain(resolvedBody));
  };

  const handleSend = async () => {
    if (!fromAccountId || toInputs.length === 0 || !subject.trim() || !body.trim()) {
      return;
    }

    // Convert plain text body to simple HTML
    const htmlBody = body
      .split("\n")
      .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<br>"))
      .join("\n");

    await sendMutation.mutateAsync({
      emailAccountId: fromAccountId,
      to: toInputs,
      cc: ccInputs.length > 0 ? ccInputs : undefined,
      subject: subject.trim(),
      bodyHtml: htmlBody,
      opportunityId,
      inReplyToExternalId: replyTo?.externalMessageId,
      conversationId: replyTo?.conversationId || undefined,
    });

    onOpenChange(false);
  };

  const canSend =
    fromAccountId &&
    toInputs.length > 0 &&
    subject.trim() &&
    body.trim() &&
    !sendMutation.isPending;

  // Contact suggestions for To field
  const contactSuggestions = contacts
    .filter((c) => c.email && !toInputs.includes(c.email) && !ccInputs.includes(c.email))
    .filter((c) =>
      toInput
        ? c.name.toLowerCase().includes(toInput.toLowerCase()) ||
          (c.email && c.email.toLowerCase().includes(toInput.toLowerCase()))
        : true
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {replyTo
              ? `Reply${replyTo.subject ? `: ${replyTo.subject}` : ""}`
              : "New Email"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* From */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-10 shrink-0">
              From
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="flex-1 rounded border bg-background px-2 py-1.5 text-sm"
            >
              {accounts.length === 0 && (
                <option value="">No accounts connected</option>
              )}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName
                    ? `${account.displayName} (${account.email})`
                    : account.email}
                  {account.provider === "GMAIL" ? " — Gmail" : " — Outlook"}
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div className="flex items-start gap-2">
            <label className="text-xs text-muted-foreground w-10 shrink-0 pt-2">
              To
            </label>
            <div className="flex-1">
              <div className="flex flex-wrap gap-1 rounded border bg-background p-1.5 min-h-[36px]">
                {toInputs.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs"
                  >
                    {email}
                    <button
                      onClick={() => removeTo(email)}
                      className="hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  placeholder={toInputs.length === 0 ? "Add recipients..." : ""}
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                      e.preventDefault();
                      addTo();
                    }
                  }}
                  onBlur={addTo}
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none px-1 py-0.5"
                />
              </div>

              {/* Contact suggestions */}
              {toInput && contactSuggestions.length > 0 && (
                <div className="mt-1 rounded border bg-background shadow-sm max-h-32 overflow-y-auto">
                  {contactSuggestions.map((c) => (
                    <button
                      key={c.email}
                      onClick={() => {
                        if (c.email) {
                          setToInputs((prev) => [...prev, c.email as string]);
                          setToInput("");
                        }
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Cc toggle */}
              <button
                onClick={() => setShowCc(!showCc)}
                className="mt-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                {showCc ? (
                  <ChevronUp className="h-2.5 w-2.5" />
                ) : (
                  <ChevronDown className="h-2.5 w-2.5" />
                )}
                Cc
              </button>
            </div>
          </div>

          {/* Cc */}
          {showCc && (
            <div className="flex items-start gap-2">
              <label className="text-xs text-muted-foreground w-10 shrink-0 pt-2">
                Cc
              </label>
              <div className="flex flex-wrap gap-1 rounded border bg-background p-1.5 min-h-[36px] flex-1">
                {ccInputs.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {email}
                    <button
                      onClick={() => removeCc(email)}
                      className="hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  type="email"
                  placeholder=""
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                      e.preventDefault();
                      addCc();
                    }
                  }}
                  onBlur={addCc}
                  className="flex-1 min-w-[120px] bg-transparent text-sm outline-none px-1 py-0.5"
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-10 shrink-0">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="flex-1 rounded border bg-background px-2 py-1.5 text-sm"
            />
          </div>

          {/* Template selector */}
          {!replyTo && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-10 shrink-0">
                Template
              </label>
              <TemplateSelector
                dealTitle={dealTitle}
                onApply={handleApplyTemplate}
              />
            </div>
          )}

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email..."
            rows={12}
            className="w-full rounded border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
