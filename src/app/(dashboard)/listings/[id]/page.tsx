"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  EyeOff,
  Eye,
  PlusCircle,
  Calendar,
  MapPin,
  Building2,
  Users,
  Phone,
  Mail,
  PenLine,
  X,
  Save,
  RefreshCw,
  Shield,
  Award,
  Globe,
  UserCheck,
  Network,
} from "lucide-react";
import {
  useListing,
  useUpdateListing,
  useUpdateListingSource,
  useToggleHidden,
  usePromoteToPipeline,
} from "@/hooks/use-listings";
import { FinancialSummary } from "@/components/listings/financial-summary";
import { ListingSourceBadges } from "@/components/listings/listing-source-badges";
import { FitScoreGauge } from "@/components/listings/fit-score-gauge";
import { TierBadge } from "@/components/listings/tier-badge";
import { TradeBadges } from "@/components/listings/trade-badges";
import { PromoteDialog } from "@/components/promote-dialog";
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/utils";
import { PIPELINE_STAGES, PRIMARY_TRADES, TIERS, type PrimaryTradeKey, type TierKey } from "@/lib/constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MiniMap } from "@/components/maps/mini-map";

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: listing, isLoading, error } = useListing(id);
  const updateListing = useUpdateListing();
  const updateSource = useUpdateListingSource();
  const toggleHidden = useToggleHidden();
  const promoteToPipeline = usePromoteToPipeline();
  const queryClient = useQueryClient();

  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [editingSources, setEditingSources] = useState<Record<string, string>>({});
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);

  const recomputeScore = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/listings/${id}/score`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to recompute score");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load listing</p>
        <Link href="/listings" className="mt-2 text-sm text-primary hover:underline">
          Back to listings
        </Link>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryContact = (listing as any).opportunity?.contacts?.find((c: { isPrimary: boolean }) => c.isPrimary)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    || (listing as any).opportunity?.contacts?.[0];

  const startEditing = () => {
    setEditData({
      title: listing.title || "",
      businessName: listing.businessName || "",
      description: listing.description || "",
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : "",
      revenue: listing.revenue ? Number(listing.revenue) : "",
      ebitda: listing.ebitda ? Number(listing.ebitda) : "",
      sde: listing.sde ? Number(listing.sde) : "",
      cashFlow: listing.cashFlow ? Number(listing.cashFlow) : "",
      inventory: listing.inventory ? Number(listing.inventory) : "",
      ffe: listing.ffe ? Number(listing.ffe) : "",
      realEstate: listing.realEstate ? Number(listing.realEstate) : "",
      city: listing.city || "",
      state: listing.state || "",
      metroArea: listing.metroArea || "",
      zipCode: listing.zipCode || "",
      industry: listing.industry || "",
      category: listing.category || "",
      employees: listing.employees || "",
      established: listing.established || "",
      sellerFinancing: listing.sellerFinancing,
      reasonForSale: listing.reasonForSale || "",
      facilities: listing.facilities || "",
      brokerName: listing.brokerName || "",
      brokerCompany: listing.brokerCompany || "",
      brokerPhone: listing.brokerPhone || "",
      brokerEmail: listing.brokerEmail || "",
      // Thesis fields
      website: listing.website || "",
      phone: listing.phone || "",
      primaryTrade: listing.primaryTrade || "",
      secondaryTrades: listing.secondaryTrades || [],
      tier: listing.tier || "",
      targetMultipleLow: listing.targetMultipleLow ?? 3.0,
      targetMultipleHigh: listing.targetMultipleHigh ?? 5.0,
      certifications: listing.certifications || [],
      dcCertifications: listing.dcCertifications || [],
      bonded: listing.bonded,
      insured: listing.insured,
      dcRelevanceScore: listing.dcRelevanceScore || "",
      dcExperience: listing.dcExperience,
      disqualificationReason: listing.disqualificationReason || "",
      synergyNotes: listing.synergyNotes || "",
    });
    // Initialize source URL editing
    const sourceEdits: Record<string, string> = {};
    if (listing.sources) {
      for (const s of listing.sources) {
        sourceEdits[s.id] = s.sourceUrl;
      }
    }
    setEditingSources(sourceEdits);
    setIsEditing(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {};
    const numericFields = [
      "askingPrice", "revenue", "ebitda", "sde", "cashFlow",
      "inventory", "ffe", "realEstate",
    ];
    const floatFields = ["targetMultipleLow", "targetMultipleHigh"];
    const intFields = ["employees", "established", "dcRelevanceScore"];
    const stringFields = [
      "title", "businessName", "description", "city", "state",
      "metroArea", "zipCode", "industry", "category",
      "reasonForSale", "facilities",
      "brokerName", "brokerCompany", "brokerPhone", "brokerEmail",
      "website", "phone", "disqualificationReason", "synergyNotes",
    ];
    const booleanFields = ["sellerFinancing", "bonded", "insured", "dcExperience"];
    const enumFields = ["primaryTrade", "tier"];
    const arrayFields = ["secondaryTrades", "certifications", "dcCertifications"];

    for (const field of numericFields) {
      const val = editData[field];
      payload[field] = (val === "" || val === null || val === undefined) ? null : Number(val);
    }

    for (const field of floatFields) {
      const val = editData[field];
      payload[field] = (val === "" || val === null || val === undefined) ? null : Number(val);
    }

    for (const field of intFields) {
      const val = editData[field];
      payload[field] = (val === "" || val === null || val === undefined) ? null : parseInt(String(val));
    }

    for (const field of stringFields) {
      const val = editData[field];
      payload[field] = val && String(val).trim() ? String(val).trim() : null;
    }

    for (const field of booleanFields) {
      if (editData[field] === true || editData[field] === false) {
        payload[field] = editData[field];
      } else {
        payload[field] = null;
      }
    }

    for (const field of enumFields) {
      const val = editData[field];
      payload[field] = val && String(val).trim() ? String(val) : null;
    }

    for (const field of arrayFields) {
      const val = editData[field];
      payload[field] = Array.isArray(val) ? val : [];
    }

    updateListing.mutate(
      { id: listing.id, data: payload },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
    // Save any source URL changes
    if (listing.sources) {
      for (const s of listing.sources as { id: string; sourceUrl: string }[]) {
        const newUrl = editingSources[s.id];
        if (newUrl && newUrl !== s.sourceUrl) {
          updateSource.mutate({
            listingId: listing.id,
            sourceId: s.id,
            sourceUrl: newUrl,
          });
        }
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setEditingSources({});
  };

  const updateField = (field: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  // Compute implied enterprise value range
  const effectiveEbitda = listing.ebitda
    ? Number(listing.ebitda)
    : listing.inferredEbitda
      ? Number(listing.inferredEbitda)
      : null;
  const multLow = listing.targetMultipleLow ?? 3.0;
  const multHigh = listing.targetMultipleHigh ?? 5.0;
  const evLow = effectiveEbitda ? effectiveEbitda * multLow : null;
  const evHigh = effectiveEbitda ? effectiveEbitda * multHigh : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/listings" className="hover:text-foreground">Listings</Link>
        <span>/</span>
        <span className="font-medium text-foreground truncate max-w-[300px]">
          {listing.title}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={String(editData.title || "")}
                onChange={(e) => updateField("title", e.target.value)}
                className="text-2xl font-semibold bg-background border rounded-md px-2 py-1 w-full"
                placeholder="Listing title"
              />
              <input
                type="text"
                value={String(editData.businessName || "")}
                onChange={(e) => updateField("businessName", e.target.value)}
                className="text-sm bg-background border rounded-md px-2 py-1 w-full"
                placeholder="Business name"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground">{listing.title}</h1>
                <TierBadge tier={listing.tier} />
              </div>
              {listing.businessName && listing.businessName !== listing.title && (
                <p className="text-muted-foreground">{listing.businessName}</p>
              )}
            </>
          )}
          <div className="mt-2 flex items-center gap-3">
            <ListingSourceBadges sources={listing.sources} />
            <span className="text-sm text-muted-foreground">
              First seen {formatRelativeDate(listing.firstSeenAt)}
            </span>
            {listing.website && (
              <a
                href={listing.website.startsWith("http") ? listing.website : `https://${listing.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Globe className="h-3 w-3" />
                Website
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateListing.isPending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateListing.isPending ? "Saving..." : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                <PenLine className="h-4 w-4" />
                Edit
              </button>
              {listing.sources
                .filter((s: { sourceUrl: string }) => !s.sourceUrl.startsWith("manual://"))
                .map((s: { id: string; sourceUrl: string }) => (
                  <a
                    key={s.id}
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Original
                  </a>
                ))}
              <button
                onClick={() => toggleHidden.mutate(listing.id)}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {listing.isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {listing.isHidden ? "Show" : "Hide"}
              </button>
              {!listing.opportunity && (
                <button
                  onClick={() => setShowPromoteDialog(true)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add to Pipeline
                </button>
              )}
              {listing.opportunity && (
                <Link
                  href={`/pipeline/${listing.opportunity.id}`}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  View in Pipeline (
                  {PIPELINE_STAGES[listing.opportunity.stage as keyof typeof PIPELINE_STAGES]?.label}
                  )
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Thesis: Tier & Fit Score Bar ─────────────────────────── */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">Fit Score</span>
              <div className="mt-1">
                <FitScoreGauge score={listing.fitScore} size="lg" />
              </div>
            </div>
            {listing.dcRelevanceScore && (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">DC Relevance</span>
                <div className="mt-1 text-lg font-semibold">{listing.dcRelevanceScore}/10</div>
              </div>
            )}
            {isEditing && (
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Tier</label>
                  <select
                    value={String(editData.tier || "")}
                    onChange={(e) => updateField("tier", e.target.value || null)}
                    className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="">No tier</option>
                    {Object.entries(TIERS).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">DC Relevance (1-10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editData.dcRelevanceScore === null || editData.dcRelevanceScore === undefined ? "" : String(editData.dcRelevanceScore)}
                    onChange={(e) => updateField("dcRelevanceScore", e.target.value ? parseInt(e.target.value) : "")}
                    className="mt-1 block w-24 rounded-md border bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
          {!isEditing && (
            <button
              onClick={() => recomputeScore.mutate()}
              disabled={recomputeScore.isPending}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${recomputeScore.isPending ? "animate-spin" : ""}`} />
              {recomputeScore.isPending ? "Computing..." : "Recompute Score"}
            </button>
          )}
        </div>
        {listing.disqualificationReason && (
          <div className="mt-3 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
            <strong>Disqualified:</strong> {listing.disqualificationReason}
          </div>
        )}
      </div>

      {/* ─── Thesis: Trade & Certifications ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-medium flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Trade Classification
          </h2>
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Primary Trade</label>
                <select
                  value={String(editData.primaryTrade || "")}
                  onChange={(e) => updateField("primaryTrade", e.target.value || null)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">Select trade...</option>
                  {Object.entries(PRIMARY_TRADES).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Secondary Trades</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(PRIMARY_TRADES).map(([key, config]) => {
                    const selected = (editData.secondaryTrades as string[] || []).includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const current = editData.secondaryTrades as string[] || [];
                          updateField(
                            "secondaryTrades",
                            selected ? current.filter((t: string) => t !== key) : [...current, key]
                          );
                        }}
                        className={`rounded-md px-2 py-0.5 text-xs font-medium border transition-colors ${
                          selected ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-4">
                <BooleanToggle
                  label="DC Experience"
                  value={editData.dcExperience as boolean | null | undefined}
                  onChange={(v) => updateField("dcExperience", v)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {listing.primaryTrade ? (
                <TradeBadges
                  primaryTrade={listing.primaryTrade}
                  secondaryTrades={listing.secondaryTrades as string[]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No trade classification set</p>
              )}
              {listing.dcExperience && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <Award className="h-4 w-4" />
                  Data center experience
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-medium flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            Certifications & Qualifications
          </h2>
          {isEditing ? (
            <div className="space-y-3">
              <EditField
                label="Certifications (comma-separated)"
                value={(editData.certifications as string[] || []).join(", ")}
                onChange={(v) => updateField("certifications", v.split(",").map((s: string) => s.trim()).filter(Boolean))}
              />
              <EditField
                label="DC Certifications (comma-separated)"
                value={(editData.dcCertifications as string[] || []).join(", ")}
                onChange={(v) => updateField("dcCertifications", v.split(",").map((s: string) => s.trim()).filter(Boolean))}
              />
              <div className="flex gap-4">
                <BooleanToggle
                  label="Bonded"
                  value={editData.bonded as boolean | null | undefined}
                  onChange={(v) => updateField("bonded", v)}
                />
                <BooleanToggle
                  label="Insured"
                  value={editData.insured as boolean | null | undefined}
                  onChange={(v) => updateField("insured", v)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {listing.certifications?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {(listing.certifications as string[]).map((cert: string) => (
                    <span
                      key={cert}
                      className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No certifications listed</p>
              )}
              {listing.dcCertifications?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">DC Certifications:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(listing.dcCertifications as string[]).map((cert: string) => (
                      <span
                        key={cert}
                        className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 text-sm">
                {listing.bonded !== null && (
                  <span className={listing.bonded ? "text-emerald-600" : "text-muted-foreground"}>
                    {listing.bonded ? "✓ Bonded" : "✗ Not Bonded"}
                  </span>
                )}
                {listing.insured !== null && (
                  <span className={listing.insured ? "text-emerald-600" : "text-muted-foreground"}>
                    {listing.insured ? "✓ Insured" : "✗ Not Insured"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      {isEditing ? (
        <div>
          <h2 className="mb-3 text-lg font-medium">Financials</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Asking Price", field: "askingPrice" },
              { label: "Revenue", field: "revenue" },
              { label: "EBITDA", field: "ebitda" },
              { label: "SDE", field: "sde" },
              { label: "Cash Flow", field: "cashFlow" },
              { label: "Inventory", field: "inventory" },
              { label: "FF&E", field: "ffe" },
              { label: "Real Estate", field: "realEstate" },
            ].map((item) => (
              <div key={item.field} className="rounded-md border p-3">
                <label className="text-xs text-muted-foreground">{item.label}</label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={editData[item.field] === null || editData[item.field] === undefined ? "" : String(editData[item.field])}
                    onChange={(e) =>
                      updateField(item.field, e.target.value ? Number(e.target.value) : "")
                    }
                    className="w-full bg-background border rounded px-2 py-1 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <h2 className="mb-3 text-lg font-medium">Financials</h2>
          <FinancialSummary
            askingPrice={listing.askingPrice}
            revenue={listing.revenue}
            ebitda={listing.ebitda}
            sde={listing.sde}
            cashFlow={listing.cashFlow}
            inferredEbitda={listing.inferredEbitda}
            inferredSde={listing.inferredSde}
            inferenceMethod={listing.inferenceMethod}
            inferenceConfidence={listing.inferenceConfidence}
            priceToEbitda={listing.priceToEbitda}
            priceToSde={listing.priceToSde}
            priceToRevenue={listing.priceToRevenue}
          />
          {/* Offer price indicator from linked opportunity */}
          {listing.opportunity?.offerPrice && (
            <div className="mt-3 flex items-center gap-3 rounded-md border-l-4 border-primary bg-primary/5 px-3 py-2">
              <div>
                <span className="text-xs text-primary font-medium">Your Offer:</span>{" "}
                <span className="text-sm font-bold">{formatCurrency(Number(listing.opportunity.offerPrice))}</span>
              </div>
              {listing.askingPrice && (
                <span className="text-xs text-muted-foreground">
                  ({(() => {
                    const ask = Number(listing.askingPrice);
                    const offer = Number(listing.opportunity.offerPrice);
                    const pct = ask > 0 ? ((ask - offer) / ask) * 100 : 0;
                    return `${pct > 0 ? "-" : "+"}${Math.abs(pct).toFixed(0)}% from asking`;
                  })()})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Thesis: Valuation Range ────────────────────────────── */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-medium">Valuation Range</h2>
        {isEditing ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Target Multiple (Low)</label>
              <input
                type="number"
                step="0.1"
                value={editData.targetMultipleLow === null || editData.targetMultipleLow === undefined ? "" : String(editData.targetMultipleLow)}
                onChange={(e) => updateField("targetMultipleLow", e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                placeholder="3.0"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Target Multiple (High)</label>
              <input
                type="number"
                step="0.1"
                value={editData.targetMultipleHigh === null || editData.targetMultipleHigh === undefined ? "" : String(editData.targetMultipleHigh)}
                onChange={(e) => updateField("targetMultipleHigh", e.target.value ? Number(e.target.value) : "")}
                className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                placeholder="5.0"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">Target Multiple</span>
              <p className="mt-1 text-lg font-semibold">{multLow}x – {multHigh}x</p>
            </div>
            {effectiveEbitda && (
              <>
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground">Effective EBITDA</span>
                  <p className="mt-1 text-lg font-semibold">{formatCurrency(effectiveEbitda)}</p>
                  {listing.inferredEbitda && !listing.ebitda && (
                    <span className="text-xs text-muted-foreground">(inferred)</span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground">Implied EV Range</span>
                  <p className="mt-1 text-lg font-semibold">
                    {evLow && evHigh ? `${formatCurrency(evLow)} – ${formatCurrency(evHigh)}` : "—"}
                  </p>
                </div>
              </>
            )}
            {!effectiveEbitda && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">No EBITDA data available to compute enterprise value range</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Business Details */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-medium">Business Details</h2>
          {isEditing ? (
            <div className="space-y-3">
              <EditField label="Industry" value={editData.industry} onChange={(v) => updateField("industry", v)} />
              <EditField label="Category" value={editData.category} onChange={(v) => updateField("category", v)} />
              <div className="grid grid-cols-2 gap-3">
                <EditField label="City" value={editData.city} onChange={(v) => updateField("city", v)} />
                <EditField label="State" value={editData.state} onChange={(v) => updateField("state", v)} />
              </div>
              <EditField label="Metro Area" value={editData.metroArea} onChange={(v) => updateField("metroArea", v)} />
              <EditField label="ZIP Code" value={editData.zipCode} onChange={(v) => updateField("zipCode", v)} />
              <EditField label="Website" value={editData.website} onChange={(v) => updateField("website", v)} />
              <EditField label="Phone" value={editData.phone} onChange={(v) => updateField("phone", v)} />
              <EditField label="Employees" value={editData.employees} onChange={(v) => updateField("employees", v)} type="number" />
              <EditField label="Established" value={editData.established} onChange={(v) => updateField("established", v)} type="number" />
              <div>
                <label className="text-xs text-muted-foreground">Seller Financing</label>
                <select
                  value={editData.sellerFinancing === true ? "true" : editData.sellerFinancing === false ? "false" : ""}
                  onChange={(e) =>
                    updateField("sellerFinancing", e.target.value === "" ? null : e.target.value === "true")
                  }
                  className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">Unknown</option>
                  <option value="true">Available</option>
                  <option value="false">Not Available</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {listing.industry && <DetailRow icon={Building2} label="Industry" value={listing.industry} />}
              {listing.category && <DetailRow icon={Building2} label="Category" value={listing.category} />}
              {(listing.city || listing.state) && (
                <DetailRow icon={MapPin} label="Location" value={[listing.city, listing.state].filter(Boolean).join(", ")} />
              )}
              {listing.metroArea && <DetailRow icon={MapPin} label="Metro Area" value={listing.metroArea} />}
              {listing.latitude && listing.longitude && (
                <MiniMap
                  markers={[{
                    id: listing.id,
                    lat: listing.latitude,
                    lng: listing.longitude,
                    label: listing.title,
                    type: "listing",
                  }]}
                  height="180px"
                  className="mt-2"
                />
              )}
              {listing.phone && <DetailRow icon={Phone} label="Phone" value={listing.phone} />}
              {listing.employees && <DetailRow icon={Users} label="Employees" value={String(listing.employees)} />}
              {listing.established && <DetailRow icon={Calendar} label="Established" value={String(listing.established)} />}
              {listing.sellerFinancing !== null && (
                <DetailRow icon={Building2} label="Seller Financing" value={listing.sellerFinancing ? "Available" : "Not available"} />
              )}
              {listing.inventory && <DetailRow icon={Building2} label="Inventory" value={formatCurrency(Number(listing.inventory))} />}
              {listing.ffe && <DetailRow icon={Building2} label="FF&E" value={formatCurrency(Number(listing.ffe))} />}
              {listing.realEstate && <DetailRow icon={Building2} label="Real Estate" value={formatCurrency(Number(listing.realEstate))} />}
            </div>
          )}
        </div>

        {/* Broker / Contact */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-medium">Broker / Contact</h2>
          {isEditing ? (
            <div className="space-y-3">
              <EditField label="Broker Name" value={editData.brokerName} onChange={(v) => updateField("brokerName", v)} />
              <EditField label="Company" value={editData.brokerCompany} onChange={(v) => updateField("brokerCompany", v)} />
              <EditField label="Phone" value={editData.brokerPhone} onChange={(v) => updateField("brokerPhone", v)} />
              <EditField label="Email" value={editData.brokerEmail} onChange={(v) => updateField("brokerEmail", v)} type="email" />
            </div>
          ) : (
            <div className="space-y-3">
              {listing.brokerName && <DetailRow icon={Users} label="Broker" value={listing.brokerName} />}
              {listing.brokerCompany && <DetailRow icon={Building2} label="Company" value={listing.brokerCompany} />}
              {listing.brokerPhone && <DetailRow icon={Phone} label="Phone" value={listing.brokerPhone} />}
              {listing.brokerEmail && <DetailRow icon={Mail} label="Email" value={listing.brokerEmail} />}
              {!listing.brokerName && !listing.brokerCompany && (
                <p className="text-sm text-muted-foreground">No broker information available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Thesis: Owner / Succession Panel ───────────────────── */}
      {primaryContact && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-lg font-medium flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            Owner / Succession
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">Primary Contact</span>
              <p className="mt-1 font-medium">{primaryContact.name}</p>
              {primaryContact.role && (
                <p className="text-sm text-muted-foreground">{primaryContact.role}</p>
              )}
            </div>
            {primaryContact.estimatedAgeRange && (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Age Range</span>
                <p className="mt-1 font-medium">{primaryContact.estimatedAgeRange}</p>
              </div>
            )}
            {primaryContact.yearsInIndustry && (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Years in Industry</span>
                <p className="mt-1 font-medium">{primaryContact.yearsInIndustry}</p>
              </div>
            )}
            {primaryContact.ownershipPct !== null && primaryContact.ownershipPct !== undefined && (
              <div>
                <span className="text-xs font-medium uppercase text-muted-foreground">Ownership</span>
                <p className="mt-1 font-medium">{Math.round(primaryContact.ownershipPct * 100)}%</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            {primaryContact.foundedCompany && (
              <span className="text-emerald-600 dark:text-emerald-400">Founder</span>
            )}
            {primaryContact.hasSuccessor !== null && (
              <span className={primaryContact.hasSuccessor ? "text-emerald-600" : "text-amber-600"}>
                {primaryContact.hasSuccessor
                  ? `Successor: ${primaryContact.successorName || "Yes"}`
                  : "No successor identified"}
              </span>
            )}
            {primaryContact.familyBusiness && (
              <span className="text-blue-600 dark:text-blue-400">Family business</span>
            )}
            {primaryContact.sentiment && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {primaryContact.sentiment}
              </span>
            )}
            {primaryContact.linkedinUrl && (
              <a
                href={primaryContact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                LinkedIn
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Platform Synergy */}
      {(isEditing || listing.synergyNotes) && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-lg font-medium flex items-center gap-2">
            <Network className="h-5 w-5 text-muted-foreground" />
            Platform Synergy
          </h2>
          {isEditing ? (
            <textarea
              value={String(editData.synergyNotes || "")}
              onChange={(e) => updateField("synergyNotes", e.target.value)}
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Notes on how this business fits with the platform strategy, potential synergies, cross-selling opportunities, etc."
            />
          ) : listing.synergyNotes ? (
            <div className="prose prose-sm max-w-none text-foreground">
              <p className="whitespace-pre-wrap">{listing.synergyNotes}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No synergy notes available</p>
          )}
        </div>
      )}

      {/* Description */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-lg font-medium">Description</h2>
        {isEditing ? (
          <>
            <textarea
              value={String(editData.description || "")}
              onChange={(e) => updateField("description", e.target.value)}
              rows={6}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Business description..."
            />
            {isEditing && (
              <div className="mt-3">
                <EditField
                  label="Disqualification Reason"
                  value={editData.disqualificationReason}
                  onChange={(v) => updateField("disqualificationReason", v)}
                />
              </div>
            )}
          </>
        ) : listing.description ? (
          <div className="prose prose-sm max-w-none text-foreground">
            <p className="whitespace-pre-wrap">{listing.description}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No description available</p>
        )}
      </div>

      {/* Reason for Sale & Facilities */}
      {(isEditing || listing.reasonForSale || listing.facilities) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(isEditing || listing.reasonForSale) && (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-lg font-medium">Reason for Sale</h2>
              {isEditing ? (
                <textarea
                  value={String(editData.reasonForSale || "")}
                  onChange={(e) => updateField("reasonForSale", e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Reason for sale..."
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{listing.reasonForSale}</p>
              )}
            </div>
          )}
          {(isEditing || listing.facilities) && (
            <div className="rounded-lg border bg-card p-5">
              <h2 className="mb-3 text-lg font-medium">Facilities</h2>
              {isEditing ? (
                <textarea
                  value={String(editData.facilities || "")}
                  onChange={(e) => updateField("facilities", e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Facilities description..."
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{listing.facilities}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Source History */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-lg font-medium">Source History</h2>
        <div className="space-y-2">
          {listing.sources.map(
            (source: {
              id: string;
              platform: string;
              sourceUrl: string;
              firstScrapedAt: string;
              lastScrapedAt: string;
              isStale: boolean;
            }) => (
              <div key={source.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{source.platform}</span>
                    {!source.sourceUrl.startsWith("manual://") && (
                      <a
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="inline h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>First seen: {formatDate(source.firstScrapedAt)}</span>
                    <span>Last seen: {formatDate(source.lastScrapedAt)}</span>
                    {source.isStale && (
                      <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                        Stale
                      </span>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div className="flex items-center gap-2 pl-0">
                    <label className="text-xs text-muted-foreground shrink-0">URL:</label>
                    <input
                      type="url"
                      value={editingSources[source.id] || ""}
                      onChange={(e) => setEditingSources((prev) => ({ ...prev, [source.id]: e.target.value }))}
                      className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                      placeholder="https://..."
                    />
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Notes */}
      {listing.notes && listing.notes.length > 0 && (
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-3 text-lg font-medium">Notes</h2>
          <div className="space-y-3">
            {listing.notes.map((note: { id: string; content: string; createdAt: string }) => (
              <div key={note.id} className="border-l-2 border-muted pl-3">
                <p className="text-sm">{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promote to Pipeline Dialog */}
      {showPromoteDialog && (
        <PromoteDialog
          listing={{
            id: listing.id,
            title: listing.title,
            description: listing.description,
            askingPrice: listing.askingPrice,
            brokerName: listing.brokerName,
            brokerEmail: listing.brokerEmail,
            brokerPhone: listing.brokerPhone,
            brokerCompany: listing.brokerCompany,
          }}
          onClose={() => setShowPromoteDialog(false)}
          onPromote={(data) => {
            promoteToPipeline.mutate(
              { id: data.id, data },
              {
                onSuccess: (result) => {
                  setShowPromoteDialog(false);
                  router.push(`/pipeline/${result.id}`);
                },
              }
            );
          }}
          isPending={promoteToPipeline.isPending}
        />
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm"
        placeholder={label}
      />
    </div>
  );
}

function BooleanToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value === true ? "true" : value === false ? "false" : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : e.target.value === "true")
        }
        className="mt-1 block w-full rounded-md border bg-background px-3 py-1.5 text-sm"
      >
        <option value="">Unknown</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}
