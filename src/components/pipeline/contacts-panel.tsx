"use client";

import { useState } from "react";
import { Mail, PenLine, Phone, Star, Trash2, Users } from "lucide-react";
import { useContacts, useAddContact, useUpdateContact, useDeleteContact } from "@/hooks/use-contacts";
import { cn } from "@/lib/utils";

interface ContactsPanelProps {
  opportunityId: string;
}

const INTEREST_COLORS: Record<string, string> = {
  UNKNOWN: "text-gray-500 bg-gray-100",
  LOW: "text-red-600 bg-red-50",
  MEDIUM: "text-yellow-600 bg-yellow-50",
  HIGH: "text-green-600 bg-green-50",
  VERY_HIGH: "text-emerald-700 bg-emerald-50",
};

export function ContactsPanel({ opportunityId }: ContactsPanelProps) {
  const { data: contactsData } = useContacts(opportunityId);
  const addContactMutation = useAddContact(opportunityId);
  const updateContactMutation = useUpdateContact(opportunityId);
  const deleteContactMutation = useDeleteContact(opportunityId);

  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", company: "", role: "", interestLevel: "UNKNOWN", isPrimary: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Contacts</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {contactsData?.contacts?.length ?? 0}
          </span>
        </div>
        <button
          onClick={() => {
            setShowAdd(true);
            setNewContact({ name: "", email: "", phone: "", company: "", role: "", interestLevel: "UNKNOWN", isPrimary: false });
          }}
          className="text-xs text-primary hover:underline"
        >
          + Add Contact
        </button>
      </div>
      <div className="divide-y">
        {showAdd && (
          <div className="p-3 space-y-2 bg-muted/20">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Name *" value={newContact.name} onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
              <input type="email" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
              <input type="tel" placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact((p) => ({ ...p, phone: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
              <input type="text" placeholder="Company" value={newContact.company} onChange={(e) => setNewContact((p) => ({ ...p, company: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
              <input type="text" placeholder="Role" value={newContact.role} onChange={(e) => setNewContact((p) => ({ ...p, role: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
              <select value={newContact.interestLevel} onChange={(e) => setNewContact((p) => ({ ...p, interestLevel: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs">
                <option value="UNKNOWN">Interest: Unknown</option>
                <option value="LOW">Interest: Low</option>
                <option value="MEDIUM">Interest: Medium</option>
                <option value="HIGH">Interest: High</option>
                <option value="VERY_HIGH">Interest: Very High</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={newContact.isPrimary} onChange={(e) => setNewContact((p) => ({ ...p, isPrimary: e.target.checked }))} />
              Primary contact
            </label>
            <div className="flex gap-1">
              <button onClick={() => setShowAdd(false)} className="rounded border px-2 py-1 text-xs hover:bg-muted">Cancel</button>
              <button
                onClick={() => {
                  if (!newContact.name.trim()) return;
                  addContactMutation.mutate(newContact, { onSuccess: () => setShowAdd(false) });
                }}
                disabled={!newContact.name.trim()}
                className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {contactsData?.contacts && contactsData.contacts.length > 0 ? (
          contactsData.contacts.map((contact) => {
            const isEditing = editingId === contact.id;

            if (isEditing) {
              return (
                <div key={contact.id} className="p-3 space-y-2 bg-muted/10">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Name" value={String(editData.name || "")} onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
                    <input type="email" placeholder="Email" value={String(editData.email || "")} onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
                    <input type="tel" placeholder="Phone" value={String(editData.phone || "")} onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
                    <input type="text" placeholder="Company" value={String(editData.company || "")} onChange={(e) => setEditData((p) => ({ ...p, company: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
                    <input type="text" placeholder="Role" value={String(editData.role || "")} onChange={(e) => setEditData((p) => ({ ...p, role: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs" />
                    <select value={String(editData.interestLevel || "UNKNOWN")} onChange={(e) => setEditData((p) => ({ ...p, interestLevel: e.target.value }))} className="rounded border bg-background px-2 py-1 text-xs">
                      <option value="UNKNOWN">Interest: Unknown</option>
                      <option value="LOW">Interest: Low</option>
                      <option value="MEDIUM">Interest: Medium</option>
                      <option value="HIGH">Interest: High</option>
                      <option value="VERY_HIGH">Interest: Very High</option>
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingId(null)} className="rounded border px-2 py-1 text-xs hover:bg-muted">Cancel</button>
                    <button
                      onClick={() => {
                        updateContactMutation.mutate(
                          { contactId: contact.id, data: editData },
                          { onSuccess: () => setEditingId(null) }
                        );
                      }}
                      className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={contact.id} className="group p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {contact.isPrimary && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      <span className="text-sm font-medium">{contact.name}</span>
                      {contact.role && <span className="text-xs text-muted-foreground">· {contact.role}</span>}
                    </div>
                    {contact.company && <p className="text-xs text-muted-foreground">{contact.company}</p>}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-0.5 text-primary hover:underline">
                          <Mail className="h-2.5 w-2.5" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                          <Phone className="h-2.5 w-2.5" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.linkedinUrl && (
                        <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          LinkedIn
                        </a>
                      )}
                    </div>
                    {/* Thesis contact details */}
                    {(contact.estimatedAgeRange || contact.yearsInIndustry || contact.foundedCompany || contact.sentiment) && (
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                        {contact.estimatedAgeRange && (
                          <span className="rounded bg-muted px-1 py-0.5">Age: {contact.estimatedAgeRange}</span>
                        )}
                        {contact.yearsInIndustry && (
                          <span className="rounded bg-muted px-1 py-0.5">{contact.yearsInIndustry}yr industry</span>
                        )}
                        {contact.foundedCompany && (
                          <span className="rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5">Founder</span>
                        )}
                        {contact.ownershipPct !== null && contact.ownershipPct !== undefined && (
                          <span className="rounded bg-muted px-1 py-0.5">{Math.round(contact.ownershipPct * 100)}% owner</span>
                        )}
                        {contact.hasSuccessor === false && (
                          <span className="rounded bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-1 py-0.5">No successor</span>
                        )}
                        {contact.hasSuccessor === true && (
                          <span className="rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5">
                            Successor: {contact.successorName || "Yes"}
                          </span>
                        )}
                        {contact.sentiment && (
                          <span className="rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1 py-0.5">
                            {contact.sentiment}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", INTEREST_COLORS[contact.interestLevel] || INTEREST_COLORS.UNKNOWN)}>
                      {contact.interestLevel.replace("_", " ")}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(contact.id);
                          setEditData({
                            name: contact.name,
                            email: contact.email || "",
                            phone: contact.phone || "",
                            company: contact.company || "",
                            role: contact.role || "",
                            interestLevel: contact.interestLevel,
                          });
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Edit contact"
                      >
                        <PenLine className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this contact?")) {
                            deleteContactMutation.mutate(contact.id);
                          }
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label="Delete contact"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          !showAdd && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No contacts yet
            </div>
          )
        )}
      </div>
    </div>
  );
}
