"use client";

import { useState } from "react";
import { MessageSquare, PenLine, Users, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAddNote } from "@/hooks/use-pipeline";
import { formatRelativeDate } from "@/lib/utils";

// ── Constants ──

const NOTE_TYPE_LABELS: Record<string, string> = {
  ALL: "All",
  GENERAL: "General",
  RESEARCH: "Research",
  MEETING_NOTES: "Meeting Notes",
  AI_ANALYSIS: "AI Analysis",
  DUE_DILIGENCE: "Due Diligence",
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  GENERAL: "bg-gray-100 text-gray-700",
  RESEARCH: "bg-blue-100 text-blue-700",
  MEETING_NOTES: "bg-purple-100 text-purple-700",
  AI_ANALYSIS: "bg-amber-100 text-amber-700",
  DUE_DILIGENCE: "bg-green-100 text-green-700",
};

// ── Types ──

interface NotesSectionProps {
  opportunityId: string;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    noteType?: string;
    title?: string | null;
  }> | null;
}

// ── Component ──

export function NotesSection({ opportunityId, notes }: NotesSectionProps) {
  const queryClient = useQueryClient();
  const addNote = useAddNote();
  const [noteText, setNoteText] = useState("");
  const [noteTypeFilter, setNoteTypeFilter] = useState("ALL");
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingContent, setMeetingContent] = useState("");

  // ── Meeting notes extraction mutation ──
  const extractMeetingNotes = useMutation({
    mutationFn: async ({ content, title }: { content: string; title?: string }) => {
      const res = await fetch(`/api/pipeline/${opportunityId}/notes/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title: title || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to extract meeting notes");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Meeting notes saved and analyzed");
      queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      setShowMeetingForm(false);
      setMeetingTitle("");
      setMeetingContent("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to extract meeting notes");
    },
  });

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate({
      opportunityId,
      content: noteText.trim(),
    });
    setNoteText("");
  };

  const handleExtractMeetingNotes = () => {
    if (!meetingContent.trim()) return;
    extractMeetingNotes.mutate({
      content: meetingContent.trim(),
      title: meetingTitle.trim() || undefined,
    });
  };

  // ── Filtering ──
  const filteredNotes =
    notes?.filter(
      (n) => noteTypeFilter === "ALL" || n.noteType === noteTypeFilter,
    ) ?? [];

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Notes</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {notes?.length ?? 0}
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {Object.entries(NOTE_TYPE_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setNoteTypeFilter(key)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              noteTypeFilter === key
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Quick note input */}
      <div className="border-b p-4">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => setShowMeetingForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            {showMeetingForm ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            {showMeetingForm ? "Cancel" : "Add Meeting Notes"}
          </button>
          <button
            onClick={handleAddNote}
            disabled={!noteText.trim() || addNote.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            <PenLine className="h-3 w-3" />
            {addNote.isPending ? "Saving..." : "Add Note"}
          </button>
        </div>
      </div>

      {/* Meeting notes extraction form (inline expandable) */}
      {showMeetingForm && (
        <div className="border-b bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Paste Meeting Notes</h3>
            <button
              onClick={() => setShowMeetingForm(false)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Title (optional)"
            className="mb-2 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <textarea
            value={meetingContent}
            onChange={(e) => setMeetingContent(e.target.value)}
            placeholder="Paste your raw meeting notes here... AI will extract key insights, action items, and deal-relevant information."
            rows={8}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              AI will save the raw notes and create an analysis summary.
            </p>
            <button
              onClick={handleExtractMeetingNotes}
              disabled={!meetingContent.trim() || extractMeetingNotes.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {extractMeetingNotes.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Users className="h-3 w-3" />
                  Extract &amp; Save
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="divide-y">
        {filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div key={note.id} className="p-4">
              <div className="mb-1 flex items-center gap-2">
                {note.noteType && note.noteType !== "GENERAL" && (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      NOTE_TYPE_COLORS[note.noteType] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
                  </span>
                )}
                {!note.noteType && null}
                {note.noteType === "GENERAL" && (
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                    General
                  </span>
                )}
              </div>
              {note.title && (
                <h4 className="mb-1 text-sm font-semibold">{note.title}</h4>
              )}
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                {formatRelativeDate(note.createdAt)}
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {noteTypeFilter === "ALL"
              ? "No notes yet"
              : `No ${NOTE_TYPE_LABELS[noteTypeFilter]?.toLowerCase() ?? ""} notes`}
          </div>
        )}
      </div>
    </div>
  );
}
