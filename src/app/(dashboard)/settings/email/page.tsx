"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Mail,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Unplug,
  CloudCog,
  AlertTriangle,
  Settings2,
  Copy,
  CheckCheck,
} from "lucide-react";
import {
  useEmailAccounts,
  useSyncEmails,
  useDisconnectEmail,
  useEmailConfig,
} from "@/hooks/use-email";
import { cn, formatRelativeDate } from "@/lib/utils";

export default function EmailSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <EmailSettingsContent />
    </Suspense>
  );
}

function EmailSettingsContent() {
  const { data, isLoading } = useEmailAccounts();
  const { data: emailConfig, isLoading: configLoading } = useEmailConfig();
  const syncEmails = useSyncEmails();
  const disconnectEmail = useDisconnectEmail();
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const connectedParam = searchParams.get("connected");

  const accounts = data?.accounts ?? [];
  const connectedAccounts = accounts.filter((a) => a.isConnected);
  const disconnectedAccounts = accounts.filter((a) => !a.isConnected);

  const handleSync = (accountId: string) => {
    setSyncingAccountId(accountId);
    syncEmails.mutate(
      { accountId },
      {
        onSettled: () => setSyncingAccountId(null),
      }
    );
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/api/email/auth/callback`
    : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/email/auth/callback`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href="/settings" className="hover:text-foreground">Settings</Link>
        <span>/</span>
        <span className="font-medium text-foreground">Email Integration</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Email Integration</h1>
        <p className="text-sm text-muted-foreground">
          Connect your email accounts to sync and track emails
        </p>
      </div>

      {/* Error banner from OAuth redirect */}
      {errorParam && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <div className="text-sm font-medium text-destructive">
                Connection Failed
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {decodeURIComponent(errorParam)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success banner from OAuth redirect */}
      {connectedParam && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            Email Account Connected Successfully
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account has been linked. Click &quot;Sync Now&quot; to fetch your emails.
          </p>
        </div>
      )}

      {/* Sync result banner */}
      {syncEmails.isSuccess && syncEmails.data && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" />
            Email Sync Complete
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Synced {syncEmails.data.synced?.synced ?? 0} emails, linked{" "}
            {syncEmails.data.linked?.linked ?? 0} to opportunities.
            {(syncEmails.data.newListingsFound ?? 0) > 0 && (
              <> Found {syncEmails.data.newListingsFound} new listings from email alerts.</>
            )}
          </p>
        </div>
      )}

      {/* Setup Required Banner - shown when OAuth is not configured */}
      {!configLoading && emailConfig && !emailConfig.anyConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                OAuth Setup Required
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                Email integration requires OAuth credentials to be configured in your{" "}
                <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono">.env</code>{" "}
                file. Follow the setup guides below for your email provider.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connected accounts */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {connectedAccounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Connected Accounts
              </h2>
              {connectedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        account.provider === "GMAIL"
                          ? "bg-red-100 text-red-600"
                          : "bg-primary/10 text-primary"
                      )}>
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{account.email}</span>
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium",
                            account.provider === "GMAIL"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          )}>
                            {account.provider === "GMAIL" ? "Gmail" : "Microsoft 365"}
                          </span>
                        </div>
                        {account.displayName && (
                          <div className="text-sm text-muted-foreground">
                            {account.displayName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Connected
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <div className="text-xs text-muted-foreground">
                      Last synced:{" "}
                      {account.lastSyncAt
                        ? formatRelativeDate(account.lastSyncAt)
                        : "Never"}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSync(account.id)}
                        disabled={syncingAccountId === account.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                      >
                        {syncingAccountId === account.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Sync Now
                      </button>
                      <button
                        onClick={() =>
                          disconnectEmail.mutate({ accountId: account.id })
                        }
                        disabled={disconnectEmail.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <Unplug className="h-3.5 w-3.5" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Disconnected accounts */}
          {disconnectedAccounts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Disconnected Accounts
              </h2>
              {disconnectedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-lg border bg-card p-4 opacity-60 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{account.email}</div>
                        {account.displayName && (
                          <div className="text-sm text-muted-foreground">
                            {account.displayName}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      Disconnected
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Connect buttons */}
          {connectedAccounts.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CloudCog className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-medium">
                Connect Your Email
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Link your email account to automatically sync emails, track
                broker communications, and parse listing alerts alongside your
                deal pipeline.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                {emailConfig?.gmail ? (
                  <a
                    href="/api/email/auth?provider=gmail"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
                  >
                    <Mail className="h-4 w-4" />
                    Connect Gmail
                  </a>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600/40 px-5 py-2.5 text-sm font-medium text-white cursor-not-allowed"
                    title="Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env first"
                  >
                    <Mail className="h-4 w-4" />
                    Connect Gmail
                    <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">Setup needed</span>
                  </span>
                )}
                {emailConfig?.microsoft ? (
                  <a
                    href="/api/email/auth?provider=microsoft"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Mail className="h-4 w-4" />
                    Connect Microsoft 365
                  </a>
                ) : (
                  <span
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600/40 px-5 py-2.5 text-sm font-medium text-white cursor-not-allowed"
                    title="Configure AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID in .env first"
                  >
                    <Mail className="h-4 w-4" />
                    Connect Microsoft 365
                    <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">Setup needed</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {emailConfig?.gmail ? (
                <a
                  href="/api/email/auth?provider=gmail"
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Mail className="h-4 w-4 text-red-600" />
                  Connect Gmail
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50">
                  <Mail className="h-4 w-4" />
                  Gmail (not configured)
                </span>
              )}
              {emailConfig?.microsoft ? (
                <a
                  href="/api/email/auth?provider=microsoft"
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  Connect Microsoft 365
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed opacity-50">
                  <Mail className="h-4 w-4" />
                  Microsoft 365 (not configured)
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Setup Guides - shown when providers are not configured */}
      {!configLoading && emailConfig && (!emailConfig.gmail || !emailConfig.microsoft) && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Provider Setup Guides
          </h2>

          {/* Gmail Setup */}
          {!emailConfig.gmail && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Gmail Setup</h3>
                  <p className="text-xs text-muted-foreground">Configure Google OAuth 2.0 credentials</p>
                </div>
                <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Not configured
                </span>
              </div>
              <div className="p-4 space-y-3">
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">1</span>
                    <span>Go to <strong>Google Cloud Console</strong> → Create or select a project</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">2</span>
                    <span>Enable the <strong>Gmail API</strong> (APIs & Services → Library)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">3</span>
                    <span>Create <strong>OAuth 2.0 Credentials</strong> (APIs & Services → Credentials → Create → OAuth Client ID)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">4</span>
                    <span>Set the authorized redirect URI to:</span>
                  </li>
                </ol>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <code className="flex-1 text-xs font-mono">{redirectUri}</code>
                  <button
                    onClick={() => copyToClipboard(redirectUri, "gmail-redirect")}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {copiedField === "gmail-redirect" ? (
                      <CheckCheck className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Then add these to your <code className="rounded bg-muted px-1 py-0.5 font-mono">.env</code> file:
                </div>
                <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs space-y-1">
                  <div>GOOGLE_CLIENT_ID=&quot;your-client-id&quot;</div>
                  <div>GOOGLE_CLIENT_SECRET=&quot;your-client-secret&quot;</div>
                  <div>GOOGLE_REDIRECT_URI=&quot;{redirectUri}&quot;</div>
                </div>
              </div>
            </div>
          )}

          {/* Microsoft 365 Setup */}
          {!emailConfig.microsoft && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Microsoft 365 Setup</h3>
                  <p className="text-xs text-muted-foreground">Configure Azure AD OAuth credentials</p>
                </div>
                <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Not configured
                </span>
              </div>
              <div className="p-4 space-y-3">
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">1</span>
                    <span>Go to <strong>Azure Portal</strong> → App registrations → New registration</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">2</span>
                    <span>Add <strong>Mail.Read</strong> and <strong>Mail.ReadWrite</strong> API permissions (Microsoft Graph)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">3</span>
                    <span>Create a <strong>Client Secret</strong> (Certificates & secrets → New client secret)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">4</span>
                    <span>Set the redirect URI to:</span>
                  </li>
                </ol>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <code className="flex-1 text-xs font-mono">{redirectUri}</code>
                  <button
                    onClick={() => copyToClipboard(redirectUri, "ms-redirect")}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    {copiedField === "ms-redirect" ? (
                      <CheckCheck className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Then add these to your <code className="rounded bg-muted px-1 py-0.5 font-mono">.env</code> file:
                </div>
                <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs space-y-1">
                  <div>AZURE_AD_CLIENT_ID=&quot;your-application-client-id&quot;</div>
                  <div>AZURE_AD_CLIENT_SECRET=&quot;your-client-secret-value&quot;</div>
                  <div>AZURE_AD_TENANT_ID=&quot;your-tenant-id&quot;</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* How it works info box */}
      <div className="rounded-lg border border-info/30 bg-info/5 p-4">
        <h3 className="mb-2 text-sm font-semibold text-info">
          How Email Integration Works
        </h3>
        <ol className="space-y-1 text-sm text-muted-foreground">
          <li>
            <span className="font-medium">1. Connect your account:</span>{" "}
            Sign in with Gmail or Microsoft 365 to grant secure read access
            to your mailbox
          </li>
          <li>
            <span className="font-medium">2. Emails sync automatically:</span>{" "}
            New emails are fetched and stored locally for fast search and
            browsing
          </li>
          <li>
            <span className="font-medium">3. Auto-link to opportunities:</span>{" "}
            Emails are automatically linked to opportunities by matching
            broker email addresses and business names
          </li>
          <li>
            <span className="font-medium">4. Listing alert parsing:</span>{" "}
            Emails from BizBuySell, BizQuest, and other platforms are
            automatically parsed to extract new listings
          </li>
        </ol>
      </div>
    </div>
  );
}
