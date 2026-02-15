"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Info,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Save,
  Shield,
  Award,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  BarChart3,
} from "lucide-react";
import { useUpdateListing, useUpdateListingSource } from "@/hooks/use-listings";
import { PLATFORMS, PRIMARY_TRADES, type PlatformKey, type PrimaryTradeKey } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { TierBadge } from "@/components/listings/tier-badge";
import { FitScoreGauge } from "@/components/listings/fit-score-gauge";
import { TradeBadges } from "@/components/listings/trade-badges";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface LinkedListingCardProps {
  listing: Record<string, any>;
  offerPrice: number | null;
  offerTerms: string | null;
  industryMultiples: Record<string, any> | null;
}

export function LinkedListingCard({ listing, offerPrice, offerTerms, industryMultiples }: LinkedListingCardProps) {
  const updateListing = useUpdateListing();
  const updateSource = useUpdateListingSource();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [editingSources, setEditingSources] = useState<Record<string, string>>({});

  const startEditing = () => {
    setEditData({
      askingPrice: listing.askingPrice ? Number(listing.askingPrice) : "",
      revenue: listing.revenue ? Number(listing.revenue) : "",
      ebitda: listing.ebitda ? Number(listing.ebitda) : "",
      sde: listing.sde ? Number(listing.sde) : "",
      cashFlow: listing.cashFlow ? Number(listing.cashFlow) : "",
      inventory: listing.inventory ? Number(listing.inventory) : "",
      ffe: listing.ffe ? Number(listing.ffe) : "",
      realEstate: listing.realEstate ? Number(listing.realEstate) : "",
      industry: listing.industry || "",
      city: listing.city || "",
      state: listing.state || "",
      employees: listing.employees || "",
      established: listing.established || "",
      website: listing.website || "",
      phone: listing.phone || "",
      brokerName: listing.brokerName || "",
      brokerCompany: listing.brokerCompany || "",
      brokerPhone: listing.brokerPhone || "",
      brokerEmail: listing.brokerEmail || "",
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

  const saveEdit = () => {
    const payload: Record<string, unknown> = {};
    const numericFields = ["askingPrice", "revenue", "ebitda", "sde", "cashFlow", "inventory", "ffe", "realEstate"];
    const intFields = ["employees", "established"];
    const stringFields = ["industry", "city", "state", "website", "phone", "brokerName", "brokerCompany", "brokerPhone", "brokerEmail"];
    for (const f of numericFields) {
      const v = editData[f];
      payload[f] = v === "" || v === null || v === undefined ? null : Number(v);
    }
    for (const f of intFields) {
      const v = editData[f];
      payload[f] = v === "" || v === null || v === undefined ? null : parseInt(String(v));
    }
    for (const f of stringFields) {
      const v = editData[f];
      payload[f] = v && String(v).trim() ? String(v).trim() : null;
    }
    updateListing.mutate(
      { id: String(listing.id), data: payload },
      { onSuccess: () => setIsEditing(false) }
    );
    // Save any source URL changes
    if (listing.sources) {
      for (const s of listing.sources) {
        const newUrl = editingSources[s.id];
        if (newUrl && newUrl !== s.sourceUrl) {
          updateSource.mutate({
            listingId: String(listing.id),
            sourceId: s.id,
            sourceUrl: newUrl,
          });
        }
      }
    }
  };

  const updateField = (field: string, value: unknown) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  if (!listing) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center">
        <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground">
          No listing linked to this opportunity
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Linked Listing</h2>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="Edit listing data"
            >
              <PenLine className="h-3 w-3" />
              Edit
            </button>
          )}
          <Link
            href={`/listings/${listing.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Listing
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-medium">{String(listing.title)}</h3>

        {isEditing ? (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground">City</label>
                <input type="text" value={String(editData.city || "")} onChange={(e) => updateField("city", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">State</label>
                <input type="text" value={String(editData.state || "")} onChange={(e) => updateField("state", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Industry</label>
                <input type="text" value={String(editData.industry || "")} onChange={(e) => updateField("industry", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Established</label>
                <input type="number" value={editData.established === null || editData.established === undefined || editData.established === "" ? "" : String(editData.established)} onChange={(e) => updateField("established", e.target.value ? parseInt(e.target.value) : "")} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Website URL</label>
                <input type="url" value={String(editData.website || "")} onChange={(e) => updateField("website", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" placeholder="https://example.com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Company Phone</label>
                <input type="text" value={String(editData.phone || "")} onChange={(e) => updateField("phone", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" placeholder="(555) 555-5555" />
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Financial Metrics</div>
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
                  <div key={item.field} className="rounded-md border p-2.5">
                    <label className="text-xs text-muted-foreground">{item.label}</label>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={editData[item.field] === null || editData[item.field] === undefined || editData[item.field] === "" ? "" : String(editData[item.field])}
                        onChange={(e) => updateField(item.field, e.target.value ? Number(e.target.value) : "")}
                        className="w-full bg-background border rounded px-2 py-1 text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Broker / Contact</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <input type="text" value={String(editData.brokerName || "")} onChange={(e) => updateField("brokerName", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Company</label>
                  <input type="text" value={String(editData.brokerCompany || "")} onChange={(e) => updateField("brokerCompany", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <input type="text" value={String(editData.brokerPhone || "")} onChange={(e) => updateField("brokerPhone", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email</label>
                  <input type="email" value={String(editData.brokerEmail || "")} onChange={(e) => updateField("brokerEmail", e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-3">
              <button onClick={() => setIsEditing(false)} className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">
                <X className="h-3 w-3" /> Cancel
              </button>
              <button onClick={saveEdit} disabled={updateListing.isPending} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50">
                <Save className="h-3 w-3" /> {updateListing.isPending ? "Saving..." : "Save Listing"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {listing.city && listing.state && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {String(listing.city)}, {String(listing.state)}
                </span>
              )}
              {listing.industry && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {String(listing.industry)}
                </span>
              )}
              {listing.established && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Est. {String(listing.established)}
                </span>
              )}
            </div>

            {/* Row 1: Core Financial Metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Asking Price", value: listing.askingPrice },
                { label: "Revenue", value: listing.revenue },
                { label: "EBITDA", value: listing.ebitda, inferred: listing.inferredEbitda, method: listing.inferenceMethod, confidence: listing.inferenceConfidence },
                { label: "SDE", value: listing.sde, inferred: listing.inferredSde, method: listing.inferenceMethod, confidence: listing.inferenceConfidence },
              ].map((item) => {
                const displayValue = item.value ?? ("inferred" in item ? item.inferred : null);
                const isInferred = !item.value && "inferred" in item && item.inferred;
                return (
                  <div key={item.label} className="rounded-md border bg-muted/20 p-2.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.label}
                      {isInferred && (
                        <span className="inline-flex items-center rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">
                          est.
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold">
                      {displayValue ? formatCurrency(Number(displayValue)) : "N/A"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 2: Multiples & Cash Flow */}
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(() => {
                const askPrice = listing.askingPrice ? Number(listing.askingPrice) : null;
                const ebitdaVal = listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null);
                const sdeVal = listing.sde ? Number(listing.sde) : (listing.inferredSde ? Number(listing.inferredSde) : null);
                const revenueVal = listing.revenue ? Number(listing.revenue) : null;

                const evEbitda = askPrice && ebitdaVal && ebitdaVal > 0 ? askPrice / ebitdaVal : null;
                const priceSde = askPrice && sdeVal && sdeVal > 0 ? askPrice / sdeVal : null;
                const priceRev = askPrice && revenueVal && revenueVal > 0 ? askPrice / revenueVal : null;

                return [
                  { label: "EV / EBITDA", value: evEbitda, format: "multiple" as const },
                  { label: "Price / SDE", value: priceSde, format: "multiple" as const },
                  { label: "Price / Revenue", value: priceRev, format: "multiple" as const },
                  { label: "Cash Flow", value: listing.cashFlow ? Number(listing.cashFlow) : null, format: "currency" as const },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border bg-muted/10 p-2.5">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="mt-0.5 text-sm font-semibold">
                      {item.value
                        ? item.format === "multiple"
                          ? `${item.value.toFixed(1)}x`
                          : formatCurrency(item.value)
                        : "N/A"}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Row 3: Inference & Asset Details */}
            {(listing.inferenceMethod || listing.inventory || listing.ffe || listing.realEstate) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {listing.inferenceMethod && (
                  <div className="inline-flex items-center gap-1.5 rounded-md border bg-amber-50 px-2.5 py-1 text-xs">
                    <Info className="h-3 w-3 text-amber-600" />
                    <span className="text-amber-800">
                      Inference: {String(listing.inferenceMethod).replace(/_/g, " ")}
                    </span>
                    {listing.inferenceConfidence != null && (
                      <span className="font-medium text-amber-700">
                        ({Math.round(Number(listing.inferenceConfidence) * 100)}% confidence)
                      </span>
                    )}
                  </div>
                )}
                {listing.inventory && (
                  <div className="inline-flex items-center gap-1 rounded-md border bg-muted/20 px-2.5 py-1 text-xs">
                    <span className="text-muted-foreground">Inventory:</span>
                    <span className="font-medium">{formatCurrency(Number(listing.inventory))}</span>
                  </div>
                )}
                {listing.ffe && (
                  <div className="inline-flex items-center gap-1 rounded-md border bg-muted/20 px-2.5 py-1 text-xs">
                    <span className="text-muted-foreground">FF&E:</span>
                    <span className="font-medium">{formatCurrency(Number(listing.ffe))}</span>
                  </div>
                )}
                {listing.realEstate && (
                  <div className="inline-flex items-center gap-1 rounded-md border bg-muted/20 px-2.5 py-1 text-xs">
                    <span className="text-muted-foreground">Real Estate:</span>
                    <span className="font-medium">{formatCurrency(Number(listing.realEstate))}</span>
                  </div>
                )}
              </div>
            )}

            {/* Industry Benchmark Comparison */}
            {industryMultiples && (() => {
              const benchmarks = industryMultiples;
              const askPrice = listing.askingPrice ? Number(listing.askingPrice) : null;
              const ebitdaVal = listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null);
              const sdeVal = listing.sde ? Number(listing.sde) : (listing.inferredSde ? Number(listing.inferredSde) : null);

              const dealEbitdaMultiple = askPrice && ebitdaVal && ebitdaVal > 0 ? askPrice / ebitdaVal : null;
              const dealSdeMultiple = askPrice && sdeVal && sdeVal > 0 ? askPrice / sdeVal : null;

              const hasComparison = (dealEbitdaMultiple && benchmarks.ebitdaMedian) || (dealSdeMultiple && benchmarks.sdeMedian);
              if (!hasComparison) return null;

              return (
                <div className="mt-3 rounded-md border bg-blue-50/50 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-800">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Industry Benchmark: {String(benchmarks.industry)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {dealEbitdaMultiple && benchmarks.ebitdaMedian && (
                      <div>
                        <div className="text-[10px] uppercase text-blue-600">EV/EBITDA</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">{dealEbitdaMultiple.toFixed(1)}x</span>
                          <span className="text-xs text-muted-foreground">vs</span>
                          <span className="text-xs text-blue-700">
                            {Number(benchmarks.ebitdaMedian).toFixed(1)}x median
                          </span>
                          {dealEbitdaMultiple < Number(benchmarks.ebitdaMedian) ? (
                            <TrendingDown className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingUp className="h-3 w-3 text-amber-600" />
                          )}
                        </div>
                        {benchmarks.ebitdaLow != null && benchmarks.ebitdaHigh != null && (
                          <div className="text-[10px] text-muted-foreground">
                            Range: {Number(benchmarks.ebitdaLow).toFixed(1)}x - {Number(benchmarks.ebitdaHigh).toFixed(1)}x
                          </div>
                        )}
                      </div>
                    )}
                    {dealSdeMultiple && benchmarks.sdeMedian && (
                      <div>
                        <div className="text-[10px] uppercase text-blue-600">Price/SDE</div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold">{dealSdeMultiple.toFixed(1)}x</span>
                          <span className="text-xs text-muted-foreground">vs</span>
                          <span className="text-xs text-blue-700">
                            {Number(benchmarks.sdeMedian).toFixed(1)}x median
                          </span>
                          {dealSdeMultiple < Number(benchmarks.sdeMedian) ? (
                            <TrendingDown className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingUp className="h-3 w-3 text-amber-600" />
                          )}
                        </div>
                        {benchmarks.sdeLow != null && benchmarks.sdeHigh != null && (
                          <div className="text-[10px] text-muted-foreground">
                            Range: {Number(benchmarks.sdeLow).toFixed(1)}x - {Number(benchmarks.sdeHigh).toFixed(1)}x
                          </div>
                        )}
                      </div>
                    )}
                    {benchmarks.ebitdaMarginMedian != null && (
                      <div>
                        <div className="text-[10px] uppercase text-blue-600">Ind. EBITDA Margin</div>
                        <span className="text-sm font-bold">
                          {(Number(benchmarks.ebitdaMarginMedian) * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Asking Price vs Offer Price comparison */}
            {offerPrice && (
              <div className="mt-4 rounded-md border-l-4 border-primary bg-primary/5 p-3">
                <div className="text-xs font-medium text-primary mb-2">Price Comparison</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase">Asking Price (Seller)</div>
                    <div className="text-sm font-semibold">
                      {listing.askingPrice ? formatCurrency(Number(listing.askingPrice)) : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-primary uppercase font-medium">Your Offer (Buyer)</div>
                    <div className="text-sm font-bold text-primary">
                      {formatCurrency(Number(offerPrice))}
                    </div>
                  </div>
                  {listing.askingPrice && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Discount</div>
                      {(() => {
                        const ask = Number(listing.askingPrice);
                        const offer = Number(offerPrice);
                        const discountPct = ask > 0 ? ((ask - offer) / ask) * 100 : 0;
                        const discountAmt = ask - offer;
                        return (
                          <div className={`text-sm font-semibold ${discountPct > 0 ? "text-green-600" : discountPct < 0 ? "text-red-500" : ""}`}>
                            {discountPct > 0 ? "-" : discountPct < 0 ? "+" : ""}{formatCurrency(Math.abs(discountAmt))} ({Math.abs(discountPct).toFixed(0)}%)
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Offer-based multiples vs Asking-based multiples */}
                {(() => {
                  const askPrice = listing.askingPrice ? Number(listing.askingPrice) : null;
                  const offerVal = Number(offerPrice);
                  const ebitdaVal = listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null);
                  const sdeVal = listing.sde ? Number(listing.sde) : (listing.inferredSde ? Number(listing.inferredSde) : null);
                  const revenueVal = listing.revenue ? Number(listing.revenue) : null;

                  const hasMultiples = (ebitdaVal && ebitdaVal > 0) || (sdeVal && sdeVal > 0) || (revenueVal && revenueVal > 0);
                  if (!hasMultiples) return null;

                  const multiples = [
                    {
                      label: "EV/EBITDA",
                      asking: askPrice && ebitdaVal && ebitdaVal > 0 ? askPrice / ebitdaVal : null,
                      offer: ebitdaVal && ebitdaVal > 0 ? offerVal / ebitdaVal : null,
                    },
                    {
                      label: "Price/SDE",
                      asking: askPrice && sdeVal && sdeVal > 0 ? askPrice / sdeVal : null,
                      offer: sdeVal && sdeVal > 0 ? offerVal / sdeVal : null,
                    },
                    {
                      label: "Price/Rev",
                      asking: askPrice && revenueVal && revenueVal > 0 ? askPrice / revenueVal : null,
                      offer: revenueVal && revenueVal > 0 ? offerVal / revenueVal : null,
                    },
                  ].filter((m) => m.offer != null);

                  if (multiples.length === 0) return null;

                  return (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {multiples.map((m) => (
                        <div key={m.label} className="rounded border bg-background/50 p-1.5">
                          <div className="text-[10px] text-muted-foreground">{m.label}</div>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xs font-bold ${m.offer! < (m.asking ?? Infinity) ? "text-green-600" : ""}`}>
                              {m.offer!.toFixed(1)}x
                            </span>
                            {m.asking && (
                              <span className="text-[10px] text-muted-foreground line-through">
                                {m.asking.toFixed(1)}x
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {offerTerms && (
                  <p className="mt-2 text-xs text-muted-foreground">{offerTerms}</p>
                )}
              </div>
            )}

            {/* Source badges */}
            {listing.sources && listing.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {listing.sources.map((s: { id: string; platform: string; sourceUrl: string }) => (
                  <a
                    key={s.id}
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-white"
                    style={{
                      backgroundColor: PLATFORMS[s.platform as PlatformKey]?.color ?? "#6b7280",
                    }}
                  >
                    {PLATFORMS[s.platform as PlatformKey]?.shortLabel ?? s.platform}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ))}
              </div>
            )}

            {/* Editable source URLs — shown inline below badges in view mode */}
            {isEditing && listing.sources && listing.sources.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source URLs</div>
                {listing.sources.map((s: { id: string; platform: string; sourceUrl: string }) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <span
                      className="shrink-0 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ backgroundColor: PLATFORMS[s.platform as PlatformKey]?.color ?? "#6b7280" }}
                    >
                      {PLATFORMS[s.platform as PlatformKey]?.shortLabel ?? s.platform}
                    </span>
                    <input
                      type="url"
                      value={editingSources[s.id] || ""}
                      onChange={(e) => setEditingSources((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      className="flex-1 rounded border bg-background px-2 py-1 text-xs"
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Broker info */}
            {(listing.brokerName || listing.brokerCompany) && (
              <div className="mt-4 border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground">Broker</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {listing.brokerName && <span>{String(listing.brokerName)}</span>}
                  {listing.brokerCompany && (
                    <span className="text-muted-foreground">{String(listing.brokerCompany)}</span>
                  )}
                  {listing.brokerPhone && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {String(listing.brokerPhone)}
                    </span>
                  )}
                  {listing.brokerEmail && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {String(listing.brokerEmail)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Thesis: Tier, Fit Score, Trade ── */}
            {(listing.tier || listing.fitScore !== null || listing.primaryTrade) && (
              <div className="mt-4 border-t pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Thesis Analysis</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {listing.tier && <TierBadge tier={listing.tier} size="sm" />}
                  {listing.fitScore !== null && listing.fitScore !== undefined && (
                    <FitScoreGauge score={listing.fitScore} size="sm" />
                  )}
                  {listing.dcRelevanceScore !== null && listing.dcRelevanceScore !== undefined && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                      DC Relevance: {listing.dcRelevanceScore}/10
                    </span>
                  )}
                </div>
                {listing.primaryTrade && (
                  <div className="mt-2">
                    <TradeBadges
                      primaryTrade={listing.primaryTrade}
                      secondaryTrades={listing.secondaryTrades || []}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Certifications & Qualifications ── */}
            {((listing.certifications?.length > 0) || (listing.dcCertifications?.length > 0) || listing.bonded || listing.insured) && (
              <div className="mt-3 border-t pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Certifications</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {listing.certifications?.map((cert: string) => (
                    <span key={cert} className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                      {cert}
                    </span>
                  ))}
                  {listing.dcCertifications?.map((cert: string) => (
                    <span key={cert} className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                      {cert}
                    </span>
                  ))}
                  {listing.bonded && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <Shield className="h-2.5 w-2.5" /> Bonded
                    </span>
                  )}
                  {listing.insured && (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      <Shield className="h-2.5 w-2.5" /> Insured
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Implied Valuation Range ── */}
            {(() => {
              const ebitdaVal = listing.ebitda ? Number(listing.ebitda) : (listing.inferredEbitda ? Number(listing.inferredEbitda) : null);
              const multLow = listing.targetMultipleLow ? Number(listing.targetMultipleLow) : 3.0;
              const multHigh = listing.targetMultipleHigh ? Number(listing.targetMultipleHigh) : 5.0;
              if (!ebitdaVal || ebitdaVal <= 0) return null;
              const evLow = ebitdaVal * multLow;
              const evHigh = ebitdaVal * multHigh;
              return (
                <div className="mt-3 rounded-md border bg-gradient-to-r from-emerald-50/50 to-blue-50/50 dark:from-emerald-900/10 dark:to-blue-900/10 p-3">
                  <div className="text-xs font-medium text-muted-foreground mb-1">Implied Enterprise Value</div>
                  <div className="text-lg font-bold text-foreground">
                    {formatCurrency(evLow)} — {formatCurrency(evHigh)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    EBITDA ({formatCurrency(ebitdaVal)}) × {multLow.toFixed(1)}x – {multHigh.toFixed(1)}x target
                  </div>
                </div>
              );
            })()}

            {/* ── Website & Company Phone ── */}
            {(listing.website || listing.phone) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {listing.website && (
                  <a
                    href={String(listing.website).startsWith("http") ? listing.website : `https://${listing.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-3 w-3" />
                    <span className="text-xs">{String(listing.website).replace(/^https?:\/\//, "")}</span>
                  </a>
                )}
                {listing.phone && (
                  <a href={`tel:${listing.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3 w-3" />
                    <span className="text-xs">{String(listing.phone)}</span>
                  </a>
                )}
              </div>
            )}

            {/* Disqualification reason */}
            {listing.disqualificationReason && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-2.5">
                <div className="text-xs font-medium text-red-700 dark:text-red-400">Disqualification Reason</div>
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-300">{String(listing.disqualificationReason)}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function NoListingPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed bg-card p-8 text-center">
      <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <p className="mt-2 text-sm text-muted-foreground">
        No listing linked to this opportunity
      </p>
    </div>
  );
}
