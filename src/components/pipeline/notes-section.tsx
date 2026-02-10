"use client";

import { useState } from "react";
import { MessageSquare, PenLine } from "lucide-react";
import { useAddNote } from "@/hooks/use-pipeline";
import { formatRelativeDate } from "@/lib/utils";

interface NotesSectionProps {
  opportunityId: string;
  notes: Array<{ id: string; content: string; createdAt: string }> | null;
}

export function NotesSection({ opportunityId, notes }: NotesSectionProps) {
  const addNote = useAddNote();
  const [noteText, setNoteText] = useState("");

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate({
      opportunityId,
      content: noteText.trim(),
    });
    setNoteText("");
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Notes</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {notes?.length ?? 0}
        </span>
      </div>

      <div className="border-b p-4">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a note..."
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="mt-2 flex justify-end">
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

      <div className="divide-y">
        {notes && notes.length > 0 ? (
          notes.map((note) => (
            <div key={note.id} className="p-4">
              <p className="whitespace-pre-wrap text-sm">{note.content}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                {formatRelativeDate(note.createdAt)}
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No notes yet
          </div>
        )}
      </div>
    </div>
  );
}
