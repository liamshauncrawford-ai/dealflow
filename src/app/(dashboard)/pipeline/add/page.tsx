"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Loader2,
  Building2,
  MapPin,
  DollarSign,
  CheckCircle2,
  Plus,
  Globe,
  AlertCircle,
  Link2,
} from "lucide-react";
import { useCreateOpportunity } from "@/hooks/use-pipeline";
import {
  PIPELINE_STAGES,
  PRIORITY_LEVELS,
  type PipelineStageKey,
} from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type ImportMode = "search" | "url";
type ScrapeStatus = "idle" | "scraping" | "success" | "error";

export default function AddOpportunityPage() {
  const router = useRouter();
  const createOpportunity = useCreateOpportunity();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<PipelineStageKey>("CONTACTING");
  const [priority, setPriority] = useState<keyof typeof PRIORITY_LEVELS>("MEDIUM");
  const [offerPrice, setOfferPrice] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Import mode toggle
  const [importMode, setImportMode] = useState<ImportMode>("search");

  // Listing search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // URL import state
  const [importUrl, setImportUrl] = useState("");
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>("idle");
  const [scrapePlatform, setScrapePlatform] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [importedListingTitle, setImportedListingTitle] = useState<string | null>(null);

  // Search for listings to link
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["listing-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const res = await fetch(
        `/api/listings?search=${encodeURIComponent(searchQuery)}&limit=10`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      return data.listings ?? [];
    },
    enabled: searchQuery.trim().length >= 2,
  });

  const selectedListing = searchResults?.find(
    (l: { id: string }) => l.id === selectedListingId
  );

  const handleScrapeAndCreateListing = async () => {
    if (!importUrl.trim()) return;

    setScrapeStatus("scraping");
    setScrapeError(null);
    setScrapePlatform(null);
    setImportedListingTitle(null);

    try {
      // Step 1: Scrape the URL
      const scrapeRes = await fetch("/api/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        setScrapeStatus("error");
        setScrapeError(scrapeData.error || "Failed to scrape URL");
        return;
      }

      setScrapePlatform(scrapeData.platform);

      // Step 2: Create a listing from the scraped data
      setIsCreatingListing(true);
      const listing = scrapeData.listing;

      const listingPayload: Record<string, unknown> = {
        title: listing.title || `Listing from ${scrapeData.platform}`,
        sourceUrl: listing.sourceUrl || importUrl.trim(),
        platform: scrapeData.platform,
      };

      // Map all scraped fields
      const stringFields = [
        "businessName", "description", "city", "state", "county",
        "zipCode", "industry", "category",
        "brokerName", "brokerCompany", "brokerPhone", "brokerEmail",
        "reasonForSale", "facilities",
      ];
      for (const field of stringFields) {
        if (listing[field]) listingPayload[field] = listing[field];
      }

      const numericFields = [
        "askingPrice", "revenue", "ebitda", "sde", "cashFlow",
        "inventory", "ffe", "realEstate", "employees", "established",
      ];
      for (const field of numericFields) {
        if (listing[field] != null) listingPayload[field] = Number(listing[field]);
      }

      if (listing.sellerFinancing === true) listingPayload.sellerFinancing = true;
      if (listing.sellerFinancing === false) listingPayload.sellerFinancing = false;

      const createRes = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listingPayload),
      });

      if (!createRes.ok) {
        setScrapeStatus("error");
        setScrapeError("Scraped successfully, but failed to create listing. Try again or add manually.");
        setIsCreatingListing(false);
        return;
      }

      const createdListing = await createRes.json();
      setSelectedListingId(createdListing.id);
      setImportedListingTitle(createdListing.title);

      // Auto-fill opportunity title from listing
      if (!title) {
        setTitle(createdListing.title);
      }

      setScrapeStatus("success");
      setIsCreatingListing(false);
    } catch (err) {
      setScrapeStatus("error");
      setScrapeError(err instanceof Error ? err.message : "Failed to import listing");
      setIsCreatingListing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const data: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || undefined,
      listingId: selectedListingId || undefined,
      stage,
      priority,
    };

    // Include offer price if provided
    if (offerPrice && !isNaN(Number(offerPrice))) {
      data.offerPrice = Number(offerPrice);
    }

    createOpportunity.mutate(data, {
      onSuccess: (result) => {
        router.push(`/pipeline/${result.id}`);
      },
    });
  };

  const handleSelectListing = (listing: {
    id: string;
    title: string;
    city: string | null;
    state: string | null;
    askingPrice: string | null;
    industry: string | null;
    sources?: Array<{ platform: string }>;
  }) => {
    setSelectedListingId(listing.id);
    if (!title) {
      setTitle(listing.title);
    }
    setShowSearch(false);
    setSearchQuery("");
  };

  const handleRemoveListing = () => {
    setSelectedListingId(null);
    setImportedListingTitle(null);
    setScrapeStatus("idle");
    setImportUrl("");
  };

  const platformLabel = scrapePlatform
    ? scrapePlatform.charAt(0) + scrapePlatform.slice(1).toLowerCase()
    : null;

  const isScraping = scrapeStatus === "scraping" || isCreatingListing;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/pipeline"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pipeline
        </Link>
        <h1 className="text-2xl font-bold">Add Opportunity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new pipeline opportunity. Link to an existing listing or import from a URL.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Link to listing — with mode toggle */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium">Link to Listing (optional)</label>
            {!selectedListingId && (
              <div className="flex rounded-md border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setImportMode("search")}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    importMode === "search"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Search className="h-3 w-3" />
                  Search Existing
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode("url")}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    importMode === "url"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3 w-3" />
                  Import from URL
                </button>
              </div>
            )}
          </div>

          {/* Selected listing card */}
          {selectedListingId && (selectedListing || importedListingTitle) ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/20 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {scrapeStatus === "success" && (
                    <Link2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                  )}
                  {selectedListing?.title || importedListingTitle}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {selectedListing?.city && selectedListing?.state && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedListing.city}, {selectedListing.state}
                    </span>
                  )}
                  {selectedListing?.askingPrice && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(Number(selectedListing.askingPrice))}
                    </span>
                  )}
                  {selectedListing?.industry && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {selectedListing.industry}
                    </span>
                  )}
                  {scrapeStatus === "success" && platformLabel && (
                    <span className="text-green-600">
                      Imported from {platformLabel}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveListing}
                className="ml-2 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                Remove
              </button>
            </div>
          ) : importMode === "search" ? (
            /* Search mode */
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search listings by title, business name, or location..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearch(true);
                    }}
                    onFocus={() => setShowSearch(true)}
                    className="w-full rounded-md border bg-background py-2 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Search results dropdown */}
              {showSearch && searchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-card shadow-lg">
                  {isSearching ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map(
                      (listing: {
                        id: string;
                        title: string;
                        city: string | null;
                        state: string | null;
                        askingPrice: string | null;
                        industry: string | null;
                        opportunity: { id: string } | null;
                        sources?: Array<{ platform: string }>;
                      }) => (
                        <button
                          key={listing.id}
                          type="button"
                          onClick={() => handleSelectListing(listing)}
                          disabled={!!listing.opportunity}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50",
                            listing.opportunity && "opacity-50"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {listing.title}
                              </span>
                              {listing.opportunity && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  In Pipeline
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                              {listing.city && listing.state && (
                                <span>
                                  {listing.city}, {listing.state}
                                </span>
                              )}
                              {listing.askingPrice && (
                                <span>
                                  {formatCurrency(Number(listing.askingPrice))}
                                </span>
                              )}
                              {listing.industry && <span>{listing.industry}</span>}
                            </div>
                          </div>
                          {!listing.opportunity && (
                            <Plus className="h-4 w-4 flex-shrink-0 text-primary" />
                          )}
                        </button>
                      )
                    )
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No listings found
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* URL import mode */
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Paste a listing URL — it will be scraped, saved as a listing, and linked to this opportunity.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => {
                    setImportUrl(e.target.value);
                    if (scrapeStatus !== "idle") {
                      setScrapeStatus("idle");
                      setScrapeError(null);
                    }
                  }}
                  placeholder="https://www.bizbuysell.com/Business-Opportunity/..."
                  className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={handleScrapeAndCreateListing}
                  disabled={!importUrl.trim() || isScraping}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {isCreatingListing ? "Creating..." : "Scraping..."}
                    </>
                  ) : (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      Import
                    </>
                  )}
                </button>
              </div>

              {scrapeStatus === "error" && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{scrapeError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
            Title <span className="text-destructive">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Denver HVAC Company Acquisition"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Key notes about this opportunity..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Stage, Priority, and Offer Price row */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Initial Stage */}
          <div>
            <label htmlFor="stage" className="mb-1.5 block text-sm font-medium">
              Initial Stage
            </label>
            <select
              id="stage"
              value={stage}
              onChange={(e) => setStage(e.target.value as PipelineStageKey)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {Object.entries(PIPELINE_STAGES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="priority" className="mb-1.5 block text-sm font-medium">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as keyof typeof PRIORITY_LEVELS)
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {Object.entries(PRIORITY_LEVELS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          {/* Offer Price */}
          <div>
            <label htmlFor="offerPrice" className="mb-1.5 block text-sm font-medium">
              Offer Price ($)
            </label>
            <input
              id="offerPrice"
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder="Your intended offer"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              What you plan to offer (distinct from listing asking price)
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Link
            href="/pipeline"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!title.trim() || createOpportunity.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {createOpportunity.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Create Opportunity
          </button>
        </div>
      </form>
    </div>
  );
}
