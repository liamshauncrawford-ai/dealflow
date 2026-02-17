"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  Clock,
  Check,
  X,
  Crown,
  UserCheck,
  UserX,
  Loader2,
} from "lucide-react";
import { cn, formatRelativeDate } from "@/lib/utils";

type Tab = "users" | "requests" | "history";

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "ADMIN" | "USER";
  isApproved: boolean;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  lastActivePath: string | null;
  createdAt: string;
  _count: { auditLogs: number };
}

interface AccessRequestItem {
  id: string;
  userId: string;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "DENIED";
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    createdAt: string;
  };
}

interface LoginHistoryItem {
  id: string;
  provider: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "users", label: "Users", icon: Users },
    { key: "requests", label: "Access Requests", icon: ShieldCheck },
    { key: "history", label: "Login History", icon: Clock },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users & Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage user accounts, approve access requests, and view login history.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "requests" && <AccessRequestsTab />}
      {tab === "history" && <LoginHistoryTab />}
    </div>
  );
}

// ─────────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────────

function UsersTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ users: UserItem[] }>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const updateUser = useMutation({
    mutationFn: async (params: { userId: string; role?: string; isApproved?: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium">Last Active</th>
              <th className="px-4 py-3 font-medium">Changes</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      <img src={user.image} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {(user.name ?? user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{user.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                      user.role === "ADMIN"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {user.role === "ADMIN" && <Crown className="h-3 w-3" />}
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.isApproved ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600">
                      <UserCheck className="h-3 w-3" />
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <UserX className="h-3 w-3" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {user.lastLoginAt ? formatRelativeDate(user.lastLoginAt) : "Never"}
                </td>
                <td className="px-4 py-3">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {user.lastActiveAt ? formatRelativeDate(user.lastActiveAt) : "—"}
                    </span>
                    {user.lastActivePath && (
                      <p className="text-[10px] text-muted-foreground/60 truncate max-w-[120px]">
                        {user.lastActivePath}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {user._count.auditLogs}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {!user.isApproved && (
                      <button
                        onClick={() => updateUser.mutate({ userId: user.id, isApproved: true })}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                        title="Approve access"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    {user.role !== "ADMIN" && user.isApproved && (
                      <button
                        onClick={() => updateUser.mutate({ userId: user.id, role: "ADMIN" })}
                        className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                        title="Promote to admin"
                      >
                        <Crown className="h-3 w-3" />
                      </button>
                    )}
                    {user.role === "ADMIN" && (
                      <button
                        onClick={() => updateUser.mutate({ userId: user.id, role: "USER" })}
                        className="rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                        title="Demote to user"
                      >
                        <Users className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No users yet. Users will appear here after signing in.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Access Requests Tab
// ─────────────────────────────────────────────

function AccessRequestsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ requests: AccessRequestItem[] }>({
    queryKey: ["admin", "access-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/access-requests");
      if (!res.ok) throw new Error("Failed to fetch access requests");
      return res.json();
    },
  });

  const resolveRequest = useMutation({
    mutationFn: async (params: { requestId: string; status: string; reviewNote?: string }) => {
      const res = await fetch("/api/admin/access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Failed to update access request");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Access request updated");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const requests = data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="border-b border-amber-200 px-4 py-3 dark:border-amber-900/50">
            <h3 className="font-medium text-amber-900 dark:text-amber-100">
              Pending Requests ({pending.length})
            </h3>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-900/50">
            {pending.map((req) => (
              <div key={req.id} className="flex items-start gap-4 px-4 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {req.user.image ? (
                      <img src={req.user.image} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs font-medium text-amber-800">
                        {(req.user.name ?? req.user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-amber-900 dark:text-amber-100">
                      {req.user.name ?? req.user.email}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {req.user.email}
                    </span>
                  </div>
                  {req.reason && (
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                      &ldquo;{req.reason}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Requested {formatRelativeDate(req.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolveRequest.mutate({ requestId: req.id, status: "APPROVED" })}
                    className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                  >
                    <Check className="h-3 w-3" />
                    Approve
                  </button>
                  <button
                    onClick={() => resolveRequest.mutate({ requestId: req.id, status: "DENIED" })}
                    className="inline-flex items-center gap-1 rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                  >
                    <X className="h-3 w-3" />
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Requests */}
      {resolved.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">Resolved ({resolved.length})</h3>
          </div>
          <div className="divide-y">
            {resolved.map((req) => (
              <div key={req.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 flex-1">
                  {req.user.image ? (
                    <img src={req.user.image} alt="" className="h-6 w-6 rounded-full" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {(req.user.name ?? req.user.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{req.user.name ?? req.user.email}</span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    req.status === "APPROVED"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                  )}
                >
                  {req.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {req.reviewedAt ? formatRelativeDate(req.reviewedAt) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No access requests yet.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Login History Tab
// ─────────────────────────────────────────────

function LoginHistoryTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{
    history: LoginHistoryItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["admin", "login-history", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/login-history?page=${page}&limit=30`);
      if (!res.ok) throw new Error("Failed to fetch login history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const history = data?.history ?? [];
  const pagination = data?.pagination;

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.map((entry) => (
              <tr key={entry.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {entry.user.image ? (
                      <img src={entry.user.image} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {(entry.user.name ?? entry.user.email).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{entry.user.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{entry.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                    {entry.provider.replace("microsoft-entra-id", "Microsoft").replace("google", "Google")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatRelativeDate(entry.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No login history yet.
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 border-t px-4 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="rounded border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
