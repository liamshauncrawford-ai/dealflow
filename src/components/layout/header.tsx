"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { RefreshCw, Search, Loader2, CheckCircle2, LogOut, Crown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTriggerScrape } from "@/hooks/use-scraping";
import { NotificationBell } from "./notification-bell";

const breadcrumbMap: Record<string, string> = {
  "/": "Dashboard",
  "/listings": "Listings",
  "/listings/add": "Add Listing",
  "/pipeline": "Pipeline",
  "/pipeline/add": "Add Opportunity",
  "/activity": "Activity",
  "/hidden": "Hidden",
  "/settings": "Settings",
  "/settings/email": "Email",
  "/settings/import": "Historical Deals",
  "/settings/dedup": "Duplicates",
  "/settings/scraping": "Scraping",
  "/settings/admin": "Users & Access",
};

// Check if a segment looks like a CUID (detail page ID)
function isCuid(segment: string) {
  return /^c[a-z0-9]{20,}$/i.test(segment);
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [{ label: "Dashboard", href: "/" }];
  }

  const crumbs = [{ label: "Home", href: "/" }];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Check the full path first
    if (breadcrumbMap[currentPath]) {
      crumbs.push({ label: breadcrumbMap[currentPath], href: currentPath });
    } else if (isCuid(segment)) {
      // For detail pages, show "Deal Details" or "Listing Details" based on parent
      const parent = segments[i - 1];
      const label = parent === "pipeline" ? "Deal Details" : parent === "listings" ? "Listing Details" : "Details";
      crumbs.push({ label, href: currentPath });
    } else {
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);
      crumbs.push({ label, href: currentPath });
    }
  }

  return crumbs;
}

interface SearchResult {
  id: string;
  title: string;
  type: "listing" | "deal";
  subtitle?: string;
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumbs = getBreadcrumbs(pathname);
  const triggerScrape = useTriggerScrape();
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search
  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const [listingsRes, pipelineRes] = await Promise.all([
        fetch(`/api/listings?search=${encodeURIComponent(query)}&limit=5`),
        fetch(`/api/pipeline`),
      ]);
      const results: SearchResult[] = [];

      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        const listings = listingsData.listings || [];
        for (const l of listings) {
          if (l.title?.toLowerCase().includes(query.toLowerCase()) || l.businessName?.toLowerCase().includes(query.toLowerCase())) {
            results.push({ id: l.id, title: l.title || l.businessName, type: "listing", subtitle: l.city && l.state ? `${l.city}, ${l.state}` : undefined });
          }
        }
      }

      if (pipelineRes.ok) {
        const pipelineData = await pipelineRes.json();
        const opps = pipelineData.opportunities || [];
        for (const o of opps) {
          if (o.title?.toLowerCase().includes(query.toLowerCase())) {
            results.push({ id: o.id, title: o.title, type: "deal", subtitle: o.stage });
          }
        }
      }

      // Deduplicate — if a listing is already in pipeline, prefer the deal
      const dealListingIds = new Set(results.filter((r) => r.type === "deal").map((r) => r.id));
      const deduped = results.filter((r) => !(r.type === "listing" && dealListingIds.has(r.id)));

      setSearchResults(deduped.slice(0, 8));
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  // Close search results on click outside
  useEffect(() => {
    const handleClick = () => setShowResults(false);
    if (showResults) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [showResults]);

  // Show success indicator briefly after scrape triggers
  useEffect(() => {
    if (triggerScrape.isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [triggerScrape.isSuccess]);

  function handleScrapeNow() {
    if (triggerScrape.isPending) return;
    triggerScrape.mutate(undefined); // scrape all platforms
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 pl-14 md:px-6 md:pl-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center gap-1.5">
            {index > 0 && (
              <span className="text-muted-foreground">/</span>
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <span className="text-muted-foreground">{crumb.label}</span>
            )}
          </div>
        ))}
      </nav>

      {/* Right Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Search — hidden on mobile */}
        <div className="relative hidden md:block" onClick={(e) => e.stopPropagation()}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search deals..."
            value={searchQuery ?? ""}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchQuery && searchQuery.length >= 2) setShowResults(true); }}
            className="h-9 w-48 rounded-lg border border-input bg-muted/50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary lg:w-64"
          />
          {showResults && (searchResults.length > 0 || isSearching) && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-card shadow-lg">
              {isSearching ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto py-1">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => {
                        const href = result.type === "deal" ? `/pipeline/${result.id}` : `/listings/${result.id}`;
                        router.push(href);
                        setShowResults(false);
                        setSearchQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                      <span className={cn(
                        "inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        result.type === "deal" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {result.type === "deal" ? "Deal" : "Listing"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{result.title}</p>
                        {result.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {showResults && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-card p-4 shadow-lg">
              <p className="text-center text-sm text-muted-foreground">No results found</p>
            </div>
          )}
        </div>

        {/* Scrape Now Button — icon only on mobile */}
        <button
          type="button"
          onClick={handleScrapeNow}
          disabled={triggerScrape.isPending}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-white shadow-sm transition-colors md:px-4",
            triggerScrape.isPending
              ? "bg-primary/70 cursor-wait"
              : showSuccess
              ? "bg-green-600 hover:bg-green-700"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {triggerScrape.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : showSuccess ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="hidden md:inline">
            {triggerScrape.isPending
              ? "Scraping..."
              : showSuccess
              ? "Triggered!"
              : "Scrape Now"}
          </span>
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Menu */}
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!session?.user) return null;

  const user = session.user;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted"
      >
        {user.image ? (
          <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border bg-card shadow-lg">
          <div className="border-b p-3">
            <p className="text-sm font-medium">{user.name ?? "User"}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {user.role === "ADMIN" && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Crown className="h-2.5 w-2.5" />
                Admin
              </span>
            )}
          </div>
          <div className="p-1">
            {user.role === "ADMIN" && (
              <button
                onClick={() => {
                  router.push("/settings/admin");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Users & Access
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
