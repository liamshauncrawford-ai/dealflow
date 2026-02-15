"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  Link2,
  Mail,
  Paperclip,
  Reply,
  Search,
  Send,
  Unlink,
} from "lucide-react";
import { useLinkEmail, useUnlinkEmail } from "@/hooks/use-pipeline";
import { useEmailMessages } from "@/hooks/use-email";
import { formatRelativeDate } from "@/lib/utils";
import { ComposeEmailModal } from "./compose-email-modal";

interface EmailLink {
  id: string;
  email: {
    id: string;
    externalMessageId: string;
    subject: string | null;
    bodyPreview: string | null;
    bodyHtml: string | null;
    fromName: string | null;
    fromAddress: string;
    sentAt: string | null;
    isRead: boolean;
    hasAttachments: boolean;
    webLink: string | null;
    conversationId?: string | null;
    isSent?: boolean;
    aiSummary?: string | null;
    attachments?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }>;
  };
}

interface ReplyTo {
  externalMessageId: string;
  conversationId: string | null;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
}

interface EmailsPanelProps {
  opportunityId: string;
  emails: EmailLink[] | null;
  dealTitle: string;
  contacts: Array<{ name: string; email: string | null }>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailsPanel({
  opportunityId,
  emails,
  dealTitle,
  contacts,
}: EmailsPanelProps) {
  const linkEmailMutation = useLinkEmail(opportunityId);
  const unlinkEmailMutation = useUnlinkEmail(opportunityId);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  const { data: searchResults } = useEmailMessages(
    showSearch && searchQuery.length >= 2
      ? { search: searchQuery, limit: 10 }
      : undefined
  );

  const handleNewEmail = () => {
    setReplyTo(null);
    setShowCompose(true);
  };

  const handleReply = (link: EmailLink) => {
    setReplyTo({
      externalMessageId: link.email.externalMessageId,
      conversationId: link.email.conversationId || null,
      fromAddress: link.email.fromAddress,
      fromName: link.email.fromName,
      subject: link.email.subject,
    });
    setShowCompose(true);
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Linked Emails</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {emails?.length ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewEmail}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Send className="h-3 w-3" />
            New Email
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Link2 className="h-3 w-3" />
            Link Email
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="border-b p-3 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search emails by subject or sender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border bg-background pl-7 pr-2 py-1.5 text-xs"
              autoFocus
            />
          </div>
          {searchQuery.length >= 2 && searchResults?.emails && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searchResults.emails.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">No emails found</p>
              ) : (
                searchResults.emails.map((email) => {
                  const alreadyLinked = emails?.some(
                    (l) => l.email.id === email.id
                  );
                  return (
                    <div
                      key={email.id}
                      className="flex items-center justify-between rounded border px-2 py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{email.subject || "(no subject)"}</p>
                        <p className="text-[10px] text-muted-foreground">{email.fromName || email.fromAddress} · {email.sentAt ? formatRelativeDate(email.sentAt) : ""}</p>
                      </div>
                      {alreadyLinked ? (
                        <span className="text-[10px] text-muted-foreground">Linked</span>
                      ) : (
                        <button
                          onClick={() => {
                            linkEmailMutation.mutate(email.id, {
                              onSuccess: () => {
                                setSearchQuery("");
                                setShowSearch(false);
                              },
                            });
                          }}
                          disabled={linkEmailMutation.isPending}
                          className="rounded bg-primary px-2 py-0.5 text-[10px] text-white hover:bg-primary/90"
                        >
                          Link
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(""); }}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Close search
          </button>
        </div>
      )}

      <div className="divide-y">
        {emails && emails.length > 0 ? (
          emails.map((link) => {
            const isExpanded = expandedId === link.email.id;
            return (
              <div key={link.id} className="p-3">
                <div
                  className="flex items-start justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : link.email.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {!link.email.isRead && (
                        <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                      )}
                      {link.email.isSent && (
                        <Send className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <p className="truncate text-sm font-medium">
                        {link.email.subject ?? "(no subject)"}
                      </p>
                    </div>
                    {link.email.aiSummary && (
                      <p className="mt-0.5 text-xs text-muted-foreground/70 italic truncate">
                        {link.email.aiSummary}
                      </p>
                    )}
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p className="text-xs text-muted-foreground">
                        {link.email.isSent ? "To: " : ""}
                        {link.email.fromName ?? link.email.fromAddress}
                      </p>
                      {link.email.hasAttachments && (
                        <Paperclip className="h-2.5 w-2.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {link.email.sentAt && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(link.email.sentAt)}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2 rounded border bg-muted/20 p-3">
                    <p className="text-xs text-foreground whitespace-pre-wrap">
                      {link.email.bodyPreview || "No preview available"}
                    </p>
                    {link.email.attachments && link.email.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {link.email.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/email/attachments/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border bg-muted/50 px-2 py-1 text-[10px] text-foreground hover:bg-muted transition-colors"
                          >
                            <Download className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{att.filename}</span>
                            <span className="text-muted-foreground">
                              ({formatFileSize(att.size)})
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      {!link.email.isSent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReply(link);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          <Reply className="h-2.5 w-2.5" />
                          Reply
                        </button>
                      )}
                      {link.email.webLink && (
                        <a
                          href={link.email.webLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          View Full Email
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Unlink this email from the deal?")) {
                            unlinkEmailMutation.mutate(link.email.id);
                            setExpandedId(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-destructive hover:underline"
                      >
                        <Unlink className="h-2.5 w-2.5" />
                        Unlink
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No emails linked yet
          </div>
        )}
      </div>

      {/* Compose / Reply modal */}
      <ComposeEmailModal
        open={showCompose}
        onOpenChange={setShowCompose}
        opportunityId={opportunityId}
        dealTitle={dealTitle}
        contacts={contacts}
        replyTo={replyTo}
      />
    </div>
  );
}
