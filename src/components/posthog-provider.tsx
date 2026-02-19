"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Initialize PostHog only once, only on the client, and only if the key exists
if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_POSTHOG_KEY &&
  !posthog.__loaded
) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // We handle this manually for Next.js client nav
    capture_pageleave: true,
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") {
        ph.debug();
      }
    },
  });
}

/**
 * Captures page views on client-side navigation (Next.js doesn't trigger
 * full page loads on route changes).
 */
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!ph || !pathname) return;

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    // Avoid duplicate captures on mount
    if (lastPath.current !== url) {
      ph.capture("$pageview", { $current_url: url });
      lastPath.current = url;
    }
  }, [pathname, searchParams, ph]);

  return null;
}

/**
 * Identifies the user in PostHog once their session is available.
 * Links anonymous events to the authenticated user.
 */
function PostHogIdentify() {
  const { data: session } = useSession();
  const ph = usePostHog();
  const identified = useRef(false);

  useEffect(() => {
    if (!ph || identified.current) return;

    if (session?.user) {
      ph.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
        role: (session.user as Record<string, unknown>).role ?? "user",
      });
      identified.current = true;
    }
  }, [session, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // If no key configured, just render children without PostHog wrapping
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
