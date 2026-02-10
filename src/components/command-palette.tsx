"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Building2, Briefcase, Mail, BarChart3 } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "deal" | "listing" | "action";
  href?: string;
  action?: () => void;
  icon: typeof Search;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        setQuery("");
        setResults([]);
        setSelectedIndex(0);
      }
      return !prev;
    });
  }, []);

  useKeyboardShortcuts([
    { key: "k", meta: true, handler: toggle, global: true },
    { key: "Escape", handler: () => setOpen(false), global: true },
  ]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search logic
  useEffect(() => {
    if (!open) return;

    // Always show quick actions
    const quickActions: SearchResult[] = [
      { id: "action-new-deal", title: "New Deal", subtitle: "Create a new pipeline opportunity", type: "action", href: "/pipeline/add", icon: Briefcase },
      { id: "action-listings", title: "Go to Listings", subtitle: "View all listings", type: "action", href: "/listings", icon: Building2 },
      { id: "action-pipeline", title: "Go to Pipeline", subtitle: "View pipeline board", type: "action", href: "/pipeline", icon: BarChart3 },
      { id: "action-email", title: "Go to Email", subtitle: "View linked emails", type: "action", href: "/activity", icon: Mail },
    ];

    if (query.length < 2) {
      setResults(quickActions);
      setSelectedIndex(0);
      return;
    }

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);

    const searchAsync = async () => {
      try {
        const [pipelineRes, listingsRes] = await Promise.all([
          fetch(`/api/pipeline?limit=5`, { signal: abort.signal }).then((r) => r.json()),
          fetch(`/api/listings?search=${encodeURIComponent(query)}&pageSize=5`, { signal: abort.signal }).then((r) => r.json()),
        ]);

        if (abort.signal.aborted) return;

        const dealResults: SearchResult[] = (pipelineRes.opportunities || [])
          .filter((opp: { title: string }) =>
            opp.title.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 5)
          .map((opp: { id: string; title: string; stage: string }) => ({
            id: `deal-${opp.id}`,
            title: opp.title,
            subtitle: opp.stage.replace(/_/g, " "),
            type: "deal" as const,
            href: `/pipeline/${opp.id}`,
            icon: Briefcase,
          }));

        const listingResults: SearchResult[] = (listingsRes.listings || [])
          .slice(0, 5)
          .map((l: { id: string; title: string; city?: string; state?: string }) => ({
            id: `listing-${l.id}`,
            title: l.title,
            subtitle: [l.city, l.state].filter(Boolean).join(", ") || "Listing",
            type: "listing" as const,
            href: `/listings/${l.id}`,
            icon: Building2,
          }));

        const filtered = quickActions.filter(
          (a) => a.title.toLowerCase().includes(query.toLowerCase())
        );

        setResults([...dealResults, ...listingResults, ...filtered]);
        setSelectedIndex(0);
      } catch {
        // Aborted or failed — ignore
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    };

    const timer = setTimeout(searchAsync, 200);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, open]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    if (result.action) {
      result.action();
    } else if (result.href) {
      router.push(result.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-xl border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search deals, listings, or type a command..."
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2" aria-live="polite">
          {loading && query.length >= 2 && (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            </div>
          )}

          {results.length === 0 && query.length >= 2 && !loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}

          {results.map((result, index) => {
            const Icon = result.icon;
            return (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  index === selectedIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{result.title}</div>
                  {result.subtitle && (
                    <div className="truncate text-xs text-muted-foreground">
                      {result.subtitle}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground/50" />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
