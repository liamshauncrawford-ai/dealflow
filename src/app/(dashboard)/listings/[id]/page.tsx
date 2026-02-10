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
  Clock,
  Phone,
  Mail,
  PenLine,
  X,
  Save,
} from "lucide-react";
import {
  useListing,
  useUpdateListing,
  useToggleHidden,
  usePromoteToPipeline,
} from "@/hooks/use-listings";
import { FinancialSummary } from "@/components/listings/financial-summary";
import { ListingSourceBadges } from "@/components/listings/listing-source-badges";
import { PromoteDialog } from "@/components/promote-dialog";
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/lib/constants";

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: listing, isLoading, error } = useListing(id);
  const updateListing = useUpdateListing();
  const toggleHidden = useToggleHidden();
  const promoteToPipeline = usePromoteToPipeline();

  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);

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
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    // Build update payload — only include changed, non-empty values
    const payload: Record<string, unknown> = {};
    const numericFields = [
      "askingPrice", "revenue", "ebitda", "sde", "cashFlow",
      "inventory", "ffe", "realEstate",
    ];
    const intFields = ["employees", "established"];
    const stringFields = [
      "title", "businessName", "description", "city", "state",
      "metroArea", "zipCode", "industry", "category",
      "reasonForSale", "facilities",
      "brokerName", "brokerCompany", "brokerPhone", "brokerEmail",
    ];

    for (const field of numericFields) {
      const val = editData[field];
      if (val === "" || val === null || val === undefined) {
        payload[field] = null;
      } else {
        payload[field] = Number(val);
      }
    }

    for (const field of intFields) {
      const val = editData[field];
      if (val === "" || val === null || val === undefined) {
        payload[field] = null;
      } else {
        payload[field] = parseInt(String(val));
      }
    }

    for (const field of stringFields) {
      const val = editData[field];
      payload[field] = val && String(val).trim() ? String(val).trim() : null;
    }

    // Special handling for sellerFinancing (boolean | null)
    if (editData.sellerFinancing === true || editData.sellerFinancing === false) {
      payload.sellerFinancing = editData.sellerFinancing;
    } else {
      payload.sellerFinancing = null;
    }

    updateListing.mutate(
      { id: listing.id, data: payload },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const updateField = (field: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
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
              <h1 className="text-2xl font-semibold text-foreground">{listing.title}</h1>
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
        </div>
      )}

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

      {/* Description */}
      <div className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-lg font-medium">Description</h2>
        {isEditing ? (
          <textarea
            value={String(editData.description || "")}
            onChange={(e) => updateField("description", e.target.value)}
            rows={6}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Business description..."
          />
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
              <div key={source.id} className="flex items-center justify-between text-sm">
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
