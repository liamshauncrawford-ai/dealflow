"use client";

import { useState } from "react";
import { Calendar, PenLine, Save, X } from "lucide-react";
import { useUpdateOpportunity } from "@/hooks/use-pipeline";
import { formatDate } from "@/lib/utils";

interface KeyDatesPanelProps {
  opportunity: {
    id: string;
    createdAt: string;
    contactedAt: string | null;
    cimRequestedAt: string | null;
    ndaSignedAt: string | null;
    offerSentAt: string | null;
    underContractAt: string | null;
    closedAt: string | null;
  };
}

const DATE_FIELDS = [
  { label: "Created", field: "createdAt", editable: false },
  { label: "Contacted", field: "contactedAt", editable: true },
  { label: "CIM Requested", field: "cimRequestedAt", editable: true },
  { label: "NDA Signed", field: "ndaSignedAt", editable: true },
  { label: "Offer Sent", field: "offerSentAt", editable: true },
  { label: "Under Contract", field: "underContractAt", editable: true },
  { label: "Closed", field: "closedAt", editable: true },
] as const;

export function KeyDatesPanel({ opportunity }: KeyDatesPanelProps) {
  const updateOpportunity = useUpdateOpportunity();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const saveDate = (field: string) => {
    if (!editValue) {
      setEditingField(null);
      return;
    }
    updateOpportunity.mutate(
      { id: opportunity.id, data: { [field]: new Date(editValue).toISOString() } },
      { onSuccess: () => setEditingField(null) }
    );
  };

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Key Dates</h2>
      </div>
      <div className="divide-y">
        {DATE_FIELDS.map((item) => {
          const date = opportunity[item.field as keyof typeof opportunity] as string | null;
          const isEditing = editingField === item.field;
          if (!date && !isEditing && !item.editable) return null;
          return (
            <div key={item.field} className="flex items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="rounded border bg-background px-2 py-0.5 text-xs"
                  />
                  <button onClick={() => saveDate(item.field)} className="rounded p-0.5 text-primary hover:bg-primary/10">
                    <Save className="h-3 w-3" />
                  </button>
                  <button onClick={() => setEditingField(null)} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  {date ? (
                    <span className="text-xs font-medium">{formatDate(date)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">Not set</span>
                  )}
                  {item.editable && (
                    <button
                      onClick={() => {
                        setEditingField(item.field);
                        setEditValue(date ? new Date(date).toISOString().split("T")[0] : "");
                      }}
                      className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted"
                    >
                      <PenLine className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
