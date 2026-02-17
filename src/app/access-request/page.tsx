"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Clock, XCircle, LogOut, Send } from "lucide-react";

export default function AccessRequestPage() {
  const { data: session } = useSession();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"PENDING" | "DENIED" | "loading">("loading");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/auth/access-request");
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          setReviewNote(data.reviewNote);
          if (data.reason) setReason(data.reason);
        } else {
          setStatus("PENDING");
        }
      } catch {
        setStatus("PENDING");
      }
    }
    fetchStatus();
  }, []);

  async function handleSubmitReason() {
    try {
      const res = await fetch("/api/auth/access-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch {
      // Silently fail
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white text-xl font-bold">
            DF
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">DealFlow</h1>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          {status === "DENIED" ? (
            <>
              <div className="flex items-center justify-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Access Denied</h2>
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Your access request was reviewed and denied.
              </p>
              {reviewNote && (
                <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  <strong>Note from admin:</strong> {reviewNote}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <Clock className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Pending Approval</h2>
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Your account has been created, but an admin needs to approve your
                access before you can use DealFlow.
              </p>

              {session?.user?.name && (
                <p className="mt-3 text-center text-sm">
                  Signed in as <strong>{session.user.name}</strong>
                  <br />
                  <span className="text-muted-foreground">{session.user.email}</span>
                </p>
              )}

              {/* Reason field */}
              {!submitted ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium">
                    Why do you need access? <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="I work on the acquisitions team and need to..."
                    rows={3}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleSubmitReason}
                    disabled={!reason.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                    Submit Request
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-md bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-950/20 dark:text-green-400">
                  Request submitted! An admin will review your access soon.
                </div>
              )}
            </>
          )}

          <div className="mt-6 border-t pt-4">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
