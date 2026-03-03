"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/pipeline";

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950" />
      {/* Subtle grid pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }} />
      {/* Glow orbs */}
      <div className="fixed left-1/4 top-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
      <div className="fixed right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Logo / Brand */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-xl shadow-indigo-500/25">
            DF
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white tracking-tight">DealFlow</h1>
          <p className="mt-2 text-sm text-slate-400">
            Acquisition Deal Sourcing & Pipeline Management
          </p>
        </div>

        {/* Sign-in Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-center text-lg font-semibold text-white">Welcome Back</h2>
          <p className="mt-1 text-center text-sm text-slate-400">
            Sign in to continue to your dashboard
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-300">
              {error === "AccessDenied"
                ? "Access denied. Your account may not be approved yet."
                : error === "OAuthSignin"
                ? "Error starting the sign-in flow. Please try again."
                : error === "OAuthCallback"
                ? "Error during sign-in callback. Please try again."
                : `Sign-in error: ${error}`}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={() => signIn("google", { callbackUrl })}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-white/10 hover:border-white/20"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </button>

            <button
              onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-white/10 hover:border-white/20"
            >
              <svg className="h-5 w-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z" />
                <path fill="#81bc06" d="M12 1h10v10H12z" />
                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                <path fill="#ffba08" d="M12 12h10v10H12z" />
              </svg>
              Sign in with Microsoft
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-500">
          Access is by invitation only. After signing in for the first time,
          an admin will review and approve your account.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
