"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search,
  Plus,
  Play,
  Pencil,
  Trash2,
  Check,
  X,
  ExternalLink,
  Clock,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ScrapeRun {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  listingsFound: number;
  errors: unknown;
}

interface SearchProfile {
  id: string;
  name: string;
  platforms: string[];
  filters: Record<string, unknown>;
  cronExpression: string | null;
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  newCount: number;
  lastRun: ScrapeRun | null;
}

interface DiscoveryItem {
  id: string;
  searchProfileId: string;
  searchProfile: { name: string };
  title: string;
  businessName: string | null;
  askingPrice: string | null;
  revenue: string | null;
  cashFlow: string | null;
  ebitda: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  sourceUrl: string;
  platform: string;
  brokerName: string | null;
  brokerCompany: string | null;
  description: string | null;
  status: string;
  discoveredAt: string;
  reviewedAt: string | null;
  listingId: string | null;
}

interface QueueResponse {
  items: DiscoveryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "Never";
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const PLATFORM_LABELS: Record<string, string> = {
  BIZBUYSELL: "BizBuySell",
  BIZQUEST: "BizQuest",
  BUSINESSBROKER: "BusinessBroker.net",
  DEALSTREAM: "DealStream",
  TRANSWORLD: "Transworld",
  LOOPNET: "LoopNet",
  MANUAL: "Manual",
};

const PLATFORM_COLORS: Record<string, string> = {
  BIZBUYSELL: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  BIZQUEST: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  BUSINESSBROKER: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  DEALSTREAM: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  TRANSWORLD: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  LOOPNET: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  MANUAL: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

function platformBadge(platform: string) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
        PLATFORM_COLORS[platform] ?? PLATFORM_COLORS.MANUAL
      }`}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function humanSchedule(cron: string | null): string {
  if (!cron) return "On-demand only";
  if (cron === "0 6 * * *") return "Daily at 6:00 AM";
  if (cron === "0 6 * * 1") return "Weekly on Mondays at 6 AM";
  if (cron === "0 6 1,15 * *") return "Bi-weekly (1st & 15th)";
  // Generic fallback
  return `Cron: ${cron}`;
}

function filterSummary(filters: Record<string, unknown>): string {
  const parts: string[] = [];
  if (filters.state) parts.push(String(filters.state));
  if (filters.city) parts.push(String(filters.city));
  const minPrice = filters.minPrice || filters.minAskingPrice;
  const maxPrice = filters.maxPrice || filters.maxAskingPrice;
  if (minPrice || maxPrice) {
    const min = minPrice
      ? `$${(Number(minPrice) / 1000).toFixed(0)}K`
      : "$0";
    const max = maxPrice
      ? `$${(Number(maxPrice) / 1000000).toFixed(0)}M`
      : "+";
    parts.push(`${min}-${max}`);
  }
  if (filters.keyword) parts.push(`keyword: ${filters.keyword}`);
  if (filters.category) parts.push(String(filters.category));
  return parts.length > 0 ? parts.join(" \u00B7 ") : "No filters";
}

function formatLocation(city: string | null, state: string | null): string {
  if (city && state) return `${city}, ${state}`;
  return city || state || "\u2014";
}

const SCHEDULE_PRESETS = [
  { label: "On-demand only", value: "" },
  { label: "Daily at 6:00 AM", value: "0 6 * * *" },
  { label: "Weekly (Mondays 6 AM)", value: "0 6 * * 1" },
  { label: "Bi-weekly (1st & 15th)", value: "0 6 1,15 * *" },
  { label: "Custom", value: "__custom__" },
];

const STATUS_TABS = [
  { label: "New", value: "NEW" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "All", value: "" },
];

// All platforms available for profile creation
const ALL_PLATFORMS = ["BIZBUYSELL", "BIZQUEST", "BUSINESSBROKER", "DEALSTREAM"] as const;

// ─────────────────────────────────────────────
// Default form state
// ─────────────────────────────────────────────

interface ProfileFormState {
  name: string;
  platforms: string[];
  state: string;
  city: string;
  minPrice: string;
  maxPrice: string;
  minCashFlow: string;
  keyword: string;
  category: string;
  schedulePreset: string;
  customCron: string;
  isEnabled: boolean;
}

const DEFAULT_FORM: ProfileFormState = {
  name: "",
  platforms: [],
  state: "CO",
  city: "",
  minPrice: "",
  maxPrice: "",
  minCashFlow: "",
  keyword: "",
  category: "",
  schedulePreset: "",
  customCron: "",
  isEnabled: true,
};

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────

export default function DiscoveryPage() {
  // ── Profiles state ──
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [runningProfileId, setRunningProfileId] = useState<string | null>(null);

  // ── Queue state ──
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queuePage, setQueuePage] = useState(1);
  const [queueStatus, setQueueStatus] = useState("NEW");
  const [queueProfileFilter, setQueueProfileFilter] = useState("");
  const [queuePlatformFilter, setQueuePlatformFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<Set<string>>(
    new Set()
  );

  // ── Dialog state ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SearchProfile | null>(
    null
  );
  const [form, setForm] = useState<ProfileFormState>(DEFAULT_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // ── Fetch profiles ──
  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/discovery/profiles");
      if (!res.ok) throw new Error("Failed to fetch profiles");
      const data = await res.json();
      setProfiles(data);
    } catch {
      toast.error("Failed to load search profiles");
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  // ── Fetch queue ──
  const fetchQueue = useCallback(async () => {
    try {
      setQueueLoading(true);
      const params = new URLSearchParams();
      if (queueStatus) params.set("status", queueStatus);
      params.set("page", String(queuePage));
      params.set("pageSize", "25");
      if (queueProfileFilter)
        params.set("profileId", queueProfileFilter);
      if (queuePlatformFilter)
        params.set("platform", queuePlatformFilter);

      const res = await fetch(`/api/discovery/queue?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      const data: QueueResponse = await res.json();
      setQueue(data);
    } catch {
      toast.error("Failed to load discovery queue");
    } finally {
      setQueueLoading(false);
    }
  }, [queueStatus, queuePage, queueProfileFilter, queuePlatformFilter]);

  // ── Initial load ──
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ── Profile actions ──
  const handleRunProfile = useCallback(
    async (profileId: string) => {
      setRunningProfileId(profileId);
      try {
        const res = await fetch(
          `/api/discovery/profiles/${profileId}/run`,
          { method: "POST" }
        );
        if (!res.ok) throw new Error("Run failed");
        const data = await res.json();
        toast.success(
          `Scan complete: ${data.newDiscoveries ?? 0} new, ${data.skippedDuplicates ?? 0} skipped`
        );
        fetchProfiles();
        fetchQueue();
      } catch {
        toast.error("Failed to run search profile");
      } finally {
        setRunningProfileId(null);
      }
    },
    [fetchProfiles, fetchQueue]
  );

  const handleToggleEnabled = useCallback(
    async (profile: SearchProfile) => {
      try {
        const res = await fetch(
          `/api/discovery/profiles/${profile.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isEnabled: !profile.isEnabled }),
          }
        );
        if (!res.ok) throw new Error("Update failed");
        toast.success(
          `Profile ${profile.isEnabled ? "disabled" : "enabled"}`
        );
        fetchProfiles();
      } catch {
        toast.error("Failed to toggle profile");
      }
    },
    [fetchProfiles]
  );

  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      if (!confirm("Delete this search profile? All associated discoveries will also be deleted."))
        return;
      try {
        const res = await fetch(
          `/api/discovery/profiles/${profileId}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Delete failed");
        toast.success("Profile deleted");
        fetchProfiles();
        fetchQueue();
      } catch {
        toast.error("Failed to delete profile");
      }
    },
    [fetchProfiles, fetchQueue]
  );

  // ── Form helpers ──
  function openCreateDialog() {
    setForm(DEFAULT_FORM);
    setEditingProfile(null);
    setCreateDialogOpen(true);
  }

  function openEditDialog(profile: SearchProfile) {
    const f = profile.filters as Record<string, string>;
    const cronVal = profile.cronExpression ?? "";
    const isPreset = SCHEDULE_PRESETS.some(
      (p) => p.value === cronVal && p.value !== "__custom__"
    );
    setForm({
      name: profile.name,
      platforms: [...profile.platforms],
      state: f.state ?? "CO",
      city: f.city ?? "",
      minPrice: f.minPrice ?? f.minAskingPrice ?? "",
      maxPrice: f.maxPrice ?? f.maxAskingPrice ?? "",
      minCashFlow: f.minCashFlow ?? "",
      keyword: f.keyword ?? "",
      category: f.category ?? "",
      schedulePreset: isPreset ? cronVal : cronVal ? "__custom__" : "",
      customCron: isPreset ? "" : cronVal,
      isEnabled: profile.isEnabled,
    });
    setEditingProfile(profile);
    setCreateDialogOpen(true);
  }

  function togglePlatform(platform: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  }

  async function handleSubmitProfile() {
    if (!form.name.trim()) {
      toast.error("Profile name is required");
      return;
    }
    if (form.platforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }

    setFormSubmitting(true);

    const cronExpression =
      form.schedulePreset === "__custom__"
        ? form.customCron || null
        : form.schedulePreset || null;

    const filters: Record<string, unknown> = {};
    if (form.state) filters.state = form.state;
    if (form.city) filters.city = form.city;
    if (form.minPrice) filters.minPrice = Number(form.minPrice);
    if (form.maxPrice) filters.maxPrice = Number(form.maxPrice);
    if (form.minCashFlow) filters.minCashFlow = Number(form.minCashFlow);
    if (form.keyword) filters.keyword = form.keyword;
    if (form.category) filters.category = form.category;

    const payload = {
      name: form.name.trim(),
      platforms: form.platforms,
      filters,
      cronExpression,
      isEnabled: form.isEnabled,
    };

    try {
      const url = editingProfile
        ? `/api/discovery/profiles/${editingProfile.id}`
        : "/api/discovery/profiles";
      const method = editingProfile ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as Record<string, string>).error ?? "Failed to save"
        );
      }

      toast.success(
        editingProfile ? "Profile updated" : "Profile created"
      );
      setCreateDialogOpen(false);
      setEditingProfile(null);
      fetchProfiles();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save profile"
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  // ── Queue actions ──
  const handleAccept = useCallback(
    async (id: string) => {
      setActionInProgress((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/discovery/queue/${id}/accept`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Accept failed");
        toast.success("Discovery accepted and added to listings");
        fetchQueue();
        fetchProfiles();
      } catch {
        toast.error("Failed to accept discovery");
      } finally {
        setActionInProgress((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [fetchQueue, fetchProfiles]
  );

  const handleReject = useCallback(
    async (id: string) => {
      setActionInProgress((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/discovery/queue/${id}/reject`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Reject failed");
        toast.success("Discovery rejected");
        fetchQueue();
        fetchProfiles();
      } catch {
        toast.error("Failed to reject discovery");
      } finally {
        setActionInProgress((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [fetchQueue, fetchProfiles]
  );

  const handleBulkAction = useCallback(
    async (action: "accept" | "reject") => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      try {
        const res = await fetch("/api/discovery/queue/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        });
        if (!res.ok) throw new Error("Bulk action failed");
        toast.success(
          `${ids.length} item(s) ${action === "accept" ? "accepted" : "rejected"}`
        );
        setSelectedIds(new Set());
        fetchQueue();
        fetchProfiles();
      } catch {
        toast.error("Bulk action failed");
      }
    },
    [selectedIds, fetchQueue, fetchProfiles]
  );

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!queue) return;
    if (selectedIds.size === queue.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.items.map((item) => item.id)));
    }
  }

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [queueStatus, queueProfileFilter, queuePlatformFilter, queuePage]);

  // ── Render ──
  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <PageHeader
        title="Discovery"
        icon={Search}
        description="Automated deal sourcing across business-for-sale platforms"
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Create Search Profile
          </Button>
        }
      />

      {/* ══════════════════════════════════════════
          SECTION 1: SEARCH PROFILES
          ══════════════════════════════════════════ */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Search Profiles
        </h2>

        {profilesLoading ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <p className="mt-2">Loading profiles...</p>
          </div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No search profiles yet. Create one to start discovering
                deals automatically.
              </p>
              <Button
                onClick={openCreateDialog}
                className="mt-4"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Create Search Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card
                key={profile.id}
                className={`relative ${
                  !profile.isEnabled
                    ? "opacity-60"
                    : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {profile.name}
                    </CardTitle>
                    {profile.newCount > 0 && (
                      <Badge variant="default" className="shrink-0">
                        {profile.newCount} new
                      </Badge>
                    )}
                  </div>
                  {/* Platform badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {profile.platforms.map((p) => (
                      <span key={p}>{platformBadge(p)}</span>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Filter summary */}
                  <p className="text-sm text-muted-foreground">
                    {filterSummary(
                      profile.filters as Record<string, unknown>
                    )}
                  </p>

                  {/* Schedule & last run */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {humanSchedule(profile.cronExpression)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last run:{" "}
                    {profile.lastRun
                      ? timeAgo(profile.lastRun.startedAt)
                      : "Never run"}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleRunProfile(profile.id)}
                      disabled={runningProfileId === profile.id}
                    >
                      {runningProfileId === profile.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Run Now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(profile)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleDeleteProfile(profile.id)
                      }
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {/* Enable/Disable toggle */}
                    <button
                      onClick={() => handleToggleEnabled(profile)}
                      className={`ml-auto relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        profile.isEnabled
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      }`}
                      title={
                        profile.isEnabled
                          ? "Disable profile"
                          : "Enable profile"
                      }
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          profile.isEnabled
                            ? "translate-x-[18px]"
                            : "translate-x-[3px]"
                        }`}
                      />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          SECTION 2: DISCOVERY QUEUE
          ══════════════════════════════════════════ */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Discovery Queue
        </h2>

        {/* ── Filter bar ── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Status tabs */}
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setQueueStatus(tab.value);
                  setQueuePage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  queueStatus === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile filter */}
          <Select
            value={queueProfileFilter}
            onChange={(e) => {
              setQueueProfileFilter(e.target.value);
              setQueuePage(1);
            }}
            className="w-44"
          >
            <SelectOption value="">All Profiles</SelectOption>
            {profiles.map((p) => (
              <SelectOption key={p.id} value={p.id}>
                {p.name}
              </SelectOption>
            ))}
          </Select>

          {/* Platform filter */}
          <Select
            value={queuePlatformFilter}
            onChange={(e) => {
              setQueuePlatformFilter(e.target.value);
              setQueuePage(1);
            }}
            className="w-44"
          >
            <SelectOption value="">All Platforms</SelectOption>
            <SelectOption value="BIZBUYSELL">BizBuySell</SelectOption>
            <SelectOption value="BIZQUEST">BizQuest</SelectOption>
            <SelectOption value="BUSINESSBROKER">
              BusinessBroker.net
            </SelectOption>
            <SelectOption value="DEALSTREAM">DealStream</SelectOption>
          </Select>
        </div>

        {/* ── Bulk actions bar ── */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border bg-primary/5 px-4 py-2.5">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              size="sm"
              onClick={() => handleBulkAction("accept")}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="h-3.5 w-3.5" />
              Accept Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction("reject")}
            >
              <X className="h-3.5 w-3.5" />
              Reject Selected
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
        )}

        {/* ── Table ── */}
        {queueLoading ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <p className="mt-2">Loading discoveries...</p>
          </div>
        ) : !queue || queue.items.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {queueStatus === "NEW"
                ? "No new discoveries yet. Create a search profile and run your first scan."
                : `No ${queueStatus.toLowerCase()} discoveries found.`}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-[30%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-20" />
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={
                          queue.items.length > 0 &&
                          selectedIds.size === queue.items.length
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-input"
                      />
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Asking Price
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Cash Flow
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Location
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Platform
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Profile
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Discovered
                    </th>
                    <th className="px-3 py-3 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {queue.items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                      </td>
                      <td className="px-3 py-2.5 overflow-hidden">
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors min-w-0"
                          title={item.title}
                        >
                          <span className="truncate">
                            {item.title}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        </a>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums truncate overflow-hidden">
                        {item.askingPrice
                          ? formatCurrency(Number(item.askingPrice))
                          : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums truncate overflow-hidden">
                        {item.cashFlow
                          ? formatCurrency(Number(item.cashFlow))
                          : "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate overflow-hidden">
                        {formatLocation(item.city, item.state)}
                      </td>
                      <td className="px-3 py-2.5 overflow-hidden">
                        {platformBadge(item.platform)}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate overflow-hidden">
                        {item.searchProfile?.name ?? "\u2014"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground truncate overflow-hidden">
                        {timeAgo(item.discoveredAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        {item.status === "NEW" && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                handleAccept(item.id)
                              }
                              disabled={actionInProgress.has(
                                item.id
                              )}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                              title="Accept"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleReject(item.id)
                              }
                              disabled={actionInProgress.has(
                                item.id
                              )}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {item.status === "ACCEPTED" && (
                          <Badge variant="success">Accepted</Badge>
                        )}
                        {item.status === "REJECTED" && (
                          <Badge
                            variant="secondary"
                            className="text-muted-foreground"
                          >
                            Rejected
                          </Badge>
                        )}
                        {item.status === "EXPIRED" && (
                          <Badge variant="warning">Expired</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {queue.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {(queue.page - 1) * queue.pageSize + 1}-
                  {Math.min(
                    queue.page * queue.pageSize,
                    queue.total
                  )}{" "}
                  of {queue.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setQueuePage((p) => Math.max(1, p - 1))
                    }
                    disabled={queuePage === 1}
                    className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Page {queue.page} of {queue.totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setQueuePage((p) =>
                        Math.min(queue.totalPages, p + 1)
                      )
                    }
                    disabled={queuePage === queue.totalPages}
                    className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════
          CREATE / EDIT PROFILE DIALOG
          ══════════════════════════════════════════ */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setEditingProfile(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile
                ? "Edit Search Profile"
                : "Create Search Profile"}
            </DialogTitle>
            <DialogDescription>
              {editingProfile
                ? "Update your search criteria and schedule."
                : "Set up automated deal discovery across listing platforms."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Profile Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g., Colorado Electricians"
              />
            </div>

            {/* Platforms */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Platforms <span className="text-destructive">*</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {ALL_PLATFORMS.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.platforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {PLATFORM_LABELS[p]}
                  </label>
                ))}
              </div>
            </div>

            {/* Filter fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  State
                </label>
                <Input
                  value={form.state}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      state: e.target.value,
                    }))
                  }
                  placeholder="CO"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  City
                </label>
                <Input
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      city: e.target.value,
                    }))
                  }
                  placeholder="Denver"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Min Price
                </label>
                <Input
                  type="number"
                  value={form.minPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minPrice: e.target.value,
                    }))
                  }
                  placeholder="500000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Max Price
                </label>
                <Input
                  type="number"
                  value={form.maxPrice}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      maxPrice: e.target.value,
                    }))
                  }
                  placeholder="3000000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Min Cash Flow
                </label>
                <Input
                  type="number"
                  value={form.minCashFlow}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      minCashFlow: e.target.value,
                    }))
                  }
                  placeholder="200000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Keyword
                </label>
                <Input
                  value={form.keyword}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      keyword: e.target.value,
                    }))
                  }
                  placeholder="electrical"
                />
              </div>
            </div>

            {/* Category (full width) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Category
              </label>
              <Input
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category: e.target.value,
                  }))
                }
                placeholder="Construction / Trades"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Schedule
              </label>
              <Select
                value={form.schedulePreset}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    schedulePreset: e.target.value,
                    customCron:
                      e.target.value !== "__custom__"
                        ? ""
                        : f.customCron,
                  }))
                }
              >
                {SCHEDULE_PRESETS.map((preset) => (
                  <SelectOption
                    key={preset.value}
                    value={preset.value}
                  >
                    {preset.label}
                  </SelectOption>
                ))}
              </Select>
              {form.schedulePreset === "__custom__" && (
                <Input
                  className="mt-2"
                  value={form.customCron}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customCron: e.target.value,
                    }))
                  }
                  placeholder="0 6 * * 1,3,5"
                />
              )}
            </div>

            {/* Enable toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    isEnabled: !f.isEnabled,
                  }))
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  form.isEnabled
                    ? "bg-primary"
                    : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    form.isEnabled
                      ? "translate-x-[18px]"
                      : "translate-x-[3px]"
                  }`}
                />
              </button>
              <span className="text-sm">
                {form.isEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingProfile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitProfile}
              disabled={formSubmitting}
            >
              {formSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingProfile ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
