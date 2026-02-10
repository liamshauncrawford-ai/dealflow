"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2 } from "lucide-react";
import { PIPELINE_STAGES, PRIORITY_LEVELS, type PipelineStageKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PromoteDialogProps {
  listing: {
    id: string;
    title: string;
    description: string | null;
    askingPrice: number | string | null;
    brokerName: string | null;
    brokerEmail: string | null;
    brokerPhone: string | null;
    brokerCompany: string | null;
  };
  onClose: () => void;
  onPromote: (data: {
    id: string;
    title?: string;
    description?: string;
    stage?: string;
    priority?: string;
    offerPrice?: number;
    offerTerms?: string;
    contacts?: Array<{
      name: string;
      email?: string;
      phone?: string;
      company?: string;
      role?: string;
      isPrimary?: boolean;
    }>;
  }) => void;
  isPending?: boolean;
}

export function PromoteDialog({ listing, onClose, onPromote, isPending }: PromoteDialogProps) {
  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description || "");
  const [stage, setStage] = useState("CONTACTING");
  const [priority, setPriority] = useState("MEDIUM");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerTerms, setOfferTerms] = useState("");
  const [addBrokerAsContact, setAddBrokerAsContact] = useState(true);
  const [contacts, setContacts] = useState<
    Array<{ name: string; email: string; phone: string; company: string; role: string; isPrimary: boolean }>
  >(() => {
    // Pre-populate with broker info if available
    if (listing.brokerName) {
      return [
        {
          name: listing.brokerName,
          email: listing.brokerEmail || "",
          phone: listing.brokerPhone || "",
          company: listing.brokerCompany || "",
          role: "Broker",
          isPrimary: true,
        },
      ];
    }
    return [];
  });

  const handleSubmit = () => {
    if (!title.trim()) return;

    const promotionData: Parameters<typeof onPromote>[0] = {
      id: listing.id,
      title: title.trim(),
      description: description.trim() || undefined,
      stage,
      priority,
      offerPrice: offerPrice ? Number(offerPrice) : undefined,
      offerTerms: offerTerms.trim() || undefined,
      contacts: addBrokerAsContact
        ? contacts.filter((c) => c.name.trim())
        : [],
    };

    onPromote(promotionData);
  };

  const addEmptyContact = () => {
    setContacts((prev) => [
      ...prev,
      { name: "", email: "", phone: "", company: "", role: "", isPrimary: false },
    ]);
  };

  const updateContact = (index: number, field: string, value: string | boolean) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const removeContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <h2 className="text-lg font-semibold">Add to Pipeline</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Deal Info */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Deal Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Deal title"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Description..."
              />
            </div>
          </div>

          {/* Stage + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(PIPELINE_STAGES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {Object.entries(PRIORITY_LEVELS).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Offer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Offer Price ($)</label>
              <input
                type="number"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Offer Terms</label>
              <input
                type="text"
                value={offerTerms}
                onChange={(e) => setOfferTerms(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="e.g., SBA 7(a), 10% down"
              />
            </div>
          </div>

          {/* Contacts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Contacts</label>
              <button
                onClick={addEmptyContact}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                Add Contact
              </button>
            </div>

            {contacts.length > 0 && (
              <label className="flex items-center gap-2 mb-3 text-xs">
                <input
                  type="checkbox"
                  checked={addBrokerAsContact}
                  onChange={(e) => setAddBrokerAsContact(e.target.checked)}
                />
                Import contacts to deal
              </label>
            )}

            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={contact.isPrimary}
                        onChange={(e) => updateContact(index, "isPrimary", e.target.checked)}
                      />
                      Primary contact
                    </label>
                    <button
                      onClick={() => removeContact(index)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Name *"
                      value={contact.name}
                      onChange={(e) => updateContact(index, "name", e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={contact.email}
                      onChange={(e) => updateContact(index, "email", e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={contact.phone}
                      onChange={(e) => updateContact(index, "phone", e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Company"
                      value={contact.company}
                      onChange={(e) => updateContact(index, "company", e.target.value)}
                      className="rounded border bg-background px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Role"
                      value={contact.role}
                      onChange={(e) => updateContact(index, "role", e.target.value)}
                      className="col-span-2 rounded border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-card px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Add to Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}
