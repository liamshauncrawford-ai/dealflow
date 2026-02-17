"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Client-side hook that pings /api/internal/activity every 5 minutes
 * to record user activity (page they're on, when they were last active).
 * Should be used in the dashboard layout.
 */
export function useActivity() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    if (!session?.user?.id) return;

    const ping = () => {
      const now = Date.now();
      // Client-side throttle: don't ping more than once per 5 minutes
      if (now - lastPingRef.current < 5 * 60 * 1000) return;
      lastPingRef.current = now;

      fetch("/api/internal/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
      }).catch(() => {
        // Silently fail — activity tracking is non-critical
      });
    };

    // Ping on mount / pathname change
    ping();

    // Also set up interval for long-running sessions on the same page
    const interval = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pathname, session?.user?.id]);
}
