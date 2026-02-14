"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, Linkedin, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  PIPELINE_STAGES,
  OUTREACH_STATUSES,
  CONTACT_SENTIMENTS,
  type PipelineStageKey,
} from "@/lib/constants";
import { useUpdateContactGlobal } from "@/hooks/use-all-contacts";
import type { ContactWithOpportunity } from "@/types/contact";

interface ContactDetailSheetProps {
  contact: ContactWithOpportunity | null;
  onClose: () => void;
}

const INTEREST_LEVELS = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "VERY_HIGH", label: "Very High" },
];

function formatDate(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toDateInputValue(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return "";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return d.toISOString().split("T")[0];
}

function isOverdue(dateVal: string | Date | null | undefined): boolean {
  if (!dateVal) return false;
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  return d < new Date();
}

export function ContactDetailSheet({ contact, onClose }: ContactDetailSheetProps) {
  const updateMutation = useUpdateContactGlobal();
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [showThesis, setShowThesis] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Reset edit data when contact changes
  useEffect(() => {
    if (contact) {
      setEditData({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "",
        company: contact.company || "",
        role: contact.role || "",
        isPrimary: contact.isPrimary,
        linkedinUrl: contact.linkedinUrl || "",
        interestLevel: contact.interestLevel,
        outreachStatus: contact.outreachStatus || "",
        sentiment: contact.sentiment || "",
        nextFollowUpDate: toDateInputValue(contact.nextFollowUpDate),
        notes: contact.notes || "",
        // Thesis fields
        estimatedAgeRange: contact.estimatedAgeRange || "",
        yearsInIndustry: contact.yearsInIndustry ?? "",
        yearsAtCompany: contact.yearsAtCompany ?? "",
        foundedCompany: contact.foundedCompany ?? false,
        ownershipPct: contact.ownershipPct != null ? Math.round(contact.ownershipPct * 100) : "",
        hasPartner: contact.hasPartner ?? false,
        partnerName: contact.partnerName || "",
        hasSuccessor: contact.hasSuccessor ?? false,
        successorName: contact.successorName || "",
        familyBusiness: contact.familyBusiness ?? false,
        education: contact.education || "",
      });
      setIsDirty(false);
      setShowThesis(false);
    }
  }, [contact]);

  const updateField = (key: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!contact) return;

    // Build the update payload, converting types appropriately
    const payload: Record<string, unknown> = {};

    if (editData.name !== contact.name) payload.name = editData.name;
    if (editData.email !== (contact.email || "")) payload.email = editData.email || null;
    if (editData.phone !== (contact.phone || "")) payload.phone = editData.phone || null;
    if (editData.company !== (contact.company || "")) payload.company = editData.company || null;
    if (editData.role !== (contact.role || "")) payload.role = editData.role || null;
    if (editData.isPrimary !== contact.isPrimary) payload.isPrimary = editData.isPrimary;
    if (editData.linkedinUrl !== (contact.linkedinUrl || "")) payload.linkedinUrl = editData.linkedinUrl || null;
    if (editData.interestLevel !== contact.interestLevel) payload.interestLevel = editData.interestLevel;
    if (editData.outreachStatus !== (contact.outreachStatus || "")) payload.outreachStatus = editData.outreachStatus || null;
    if (editData.sentiment !== (contact.sentiment || "")) payload.sentiment = editData.sentiment || null;
    if (editData.notes !== (contact.notes || "")) payload.notes = editData.notes || null;

    // Follow-up date
    const originalDate = toDateInputValue(contact.nextFollowUpDate);
    if (editData.nextFollowUpDate !== originalDate) {
      payload.nextFollowUpDate = editData.nextFollowUpDate ? String(editData.nextFollowUpDate) : null;
    }

    // Thesis fields
    if (editData.estimatedAgeRange !== (contact.estimatedAgeRange || "")) payload.estimatedAgeRange = editData.estimatedAgeRange || null;
    if (editData.foundedCompany !== (contact.foundedCompany ?? false)) payload.foundedCompany = editData.foundedCompany;
    if (editData.hasPartner !== (contact.hasPartner ?? false)) payload.hasPartner = editData.hasPartner;
    if (editData.partnerName !== (contact.partnerName || "")) payload.partnerName = editData.partnerName || null;
    if (editData.hasSuccessor !== (contact.hasSuccessor ?? false)) payload.hasSuccessor = editData.hasSuccessor;
    if (editData.successorName !== (contact.successorName || "")) payload.successorName = editData.successorName || null;
    if (editData.familyBusiness !== (contact.familyBusiness ?? false)) payload.familyBusiness = editData.familyBusiness;
    if (editData.education !== (contact.education || "")) payload.education = editData.education || null;

    // Numeric thesis fields
    const yearsInIndustry = editData.yearsInIndustry === "" ? null : Number(editData.yearsInIndustry);
    if (yearsInIndustry !== contact.yearsInIndustry) payload.yearsInIndustry = yearsInIndustry;

    const yearsAtCompany = editData.yearsAtCompany === "" ? null : Number(editData.yearsAtCompany);
    if (yearsAtCompany !== contact.yearsAtCompany) payload.yearsAtCompany = yearsAtCompany;

    const ownershipPct = editData.ownershipPct === "" ? null : Number(editData.ownershipPct) / 100;
    const originalOwnership = contact.ownershipPct;
    if (ownershipPct !== originalOwnership) payload.ownershipPct = ownershipPct;

    if (Object.keys(payload).length === 0) {
      setIsDirty(false);
      return;
    }

    updateMutation.mutate(
      {
        opportunityId: contact.opportunityId,
        contactId: contact.id,
        data: payload,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          onClose();
        },
      }
    );
  };

  const overdue = contact ? isOverdue(contact.nextFollowUpDate) : false;

  return (
    <Sheet open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[480px] sm:w-[540px] overflow-y-auto" side="right">
        {contact && (
          <>
            <SheetHeader>
              <SheetTitle>{contact.name}</SheetTitle>
              <SheetDescription>
                {[contact.company, contact.role].filter(Boolean).join(" · ") || "Contact details"}
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 py-4 space-y-5">
              {/* Deal Link */}
              {contact.opportunity && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Deal:</span>
                  <Link
                    href={`/pipeline/${contact.opportunity.id}`}
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    onClick={() => onClose()}
                  >
                    {contact.opportunity.title}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium text-white",
                      PIPELINE_STAGES[contact.opportunity.stage as PipelineStageKey]?.color || "bg-gray-500"
                    )}
                  >
                    {PIPELINE_STAGES[contact.opportunity.stage as PipelineStageKey]?.label || contact.opportunity.stage}
                  </span>
                </div>
              )}

              {/* Overdue Banner */}
              {overdue && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">
                    Follow-up overdue — was due {formatDate(contact.nextFollowUpDate)}
                  </span>
                </div>
              )}

              {/* Basic Info */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Contact Info</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Name</label>
                    <input
                      type="text"
                      value={String(editData.name || "")}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                    <input
                      type="email"
                      value={String(editData.email || "")}
                      onChange={(e) => updateField("email", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                    <input
                      type="tel"
                      value={String(editData.phone || "")}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Company</label>
                    <input
                      type="text"
                      value={String(editData.company || "")}
                      onChange={(e) => updateField("company", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Role</label>
                    <input
                      type="text"
                      value={String(editData.role || "")}
                      onChange={(e) => updateField("role", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">LinkedIn</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="url"
                        value={String(editData.linkedinUrl || "")}
                        onChange={(e) => updateField("linkedinUrl", e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                      />
                      {String(editData.linkedinUrl || "") !== "" && (
                        <a
                          href={String(editData.linkedinUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-primary hover:text-primary/80"
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!editData.isPrimary}
                    onChange={(e) => updateField("isPrimary", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Primary contact
                </label>
              </section>

              {/* Status Section */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Status</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Interest</label>
                    <select
                      value={String(editData.interestLevel || "UNKNOWN")}
                      onChange={(e) => updateField("interestLevel", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      {INTEREST_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Outreach</label>
                    <select
                      value={String(editData.outreachStatus || "")}
                      onChange={(e) => updateField("outreachStatus", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">Not set</option>
                      {Object.entries(OUTREACH_STATUSES).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Sentiment</label>
                    <select
                      value={String(editData.sentiment || "")}
                      onChange={(e) => updateField("sentiment", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">Not set</option>
                      {Object.entries(CONTACT_SENTIMENTS).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Follow-up Section */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Follow-up</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Next Follow-up</label>
                    <input
                      type="date"
                      value={String(editData.nextFollowUpDate || "")}
                      onChange={(e) => updateField("nextFollowUpDate", e.target.value)}
                      className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Last Interaction</label>
                    <div className="flex items-center gap-2 h-8 px-2 text-sm text-muted-foreground">
                      {contact.lastInteractionDate ? (
                        <>
                          {formatDate(contact.lastInteractionDate)}
                          {contact.lastInteractionType && (
                            <span className="rounded border px-1 py-0.5 text-[10px]">
                              {contact.lastInteractionType}
                            </span>
                          )}
                        </>
                      ) : (
                        "No interactions"
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Thesis Section (collapsible) */}
              <section className="space-y-3">
                <button
                  onClick={() => setShowThesis(!showThesis)}
                  className="flex w-full items-center justify-between text-xs font-semibold uppercase text-muted-foreground tracking-wide hover:text-foreground"
                >
                  <span>Thesis Details</span>
                  {showThesis ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {showThesis && (
                  <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Age Range</label>
                        <input
                          type="text"
                          value={String(editData.estimatedAgeRange || "")}
                          onChange={(e) => updateField("estimatedAgeRange", e.target.value)}
                          placeholder="e.g. 55-65"
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Years in Industry</label>
                        <input
                          type="number"
                          value={String(editData.yearsInIndustry ?? "")}
                          onChange={(e) => updateField("yearsInIndustry", e.target.value)}
                          min="0"
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Years at Company</label>
                        <input
                          type="number"
                          value={String(editData.yearsAtCompany ?? "")}
                          onChange={(e) => updateField("yearsAtCompany", e.target.value)}
                          min="0"
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Ownership %</label>
                        <input
                          type="number"
                          value={String(editData.ownershipPct ?? "")}
                          onChange={(e) => updateField("ownershipPct", e.target.value)}
                          min="0"
                          max="100"
                          placeholder="0-100"
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Education</label>
                        <input
                          type="text"
                          value={String(editData.education || "")}
                          onChange={(e) => updateField("education", e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Partner Name</label>
                        <input
                          type="text"
                          value={String(editData.partnerName || "")}
                          onChange={(e) => updateField("partnerName", e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Successor Name</label>
                        <input
                          type="text"
                          value={String(editData.successorName || "")}
                          onChange={(e) => updateField("successorName", e.target.value)}
                          className="h-8 w-full rounded-md border bg-background px-2 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!editData.foundedCompany}
                          onChange={(e) => updateField("foundedCompany", e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Founder
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!editData.hasPartner}
                          onChange={(e) => updateField("hasPartner", e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Has Partner
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!editData.hasSuccessor}
                          onChange={(e) => updateField("hasSuccessor", e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Has Successor
                      </label>
                      <label className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!editData.familyBusiness}
                          onChange={(e) => updateField("familyBusiness", e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300"
                        />
                        Family Business
                      </label>
                    </div>
                  </div>
                )}
              </section>

              {/* Notes */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Notes</h3>
                <textarea
                  value={String(editData.notes || "")}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={3}
                  placeholder="Add notes about this contact..."
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none resize-y"
                />
              </section>

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || updateMutation.isPending}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
                    isDirty
                      ? "bg-primary hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-md border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
