"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { PostHogProvider } from "@/components/posthog-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <PostHogProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <CommandPalette />
          <Toaster position="bottom-right" richColors closeButton />
        </QueryClientProvider>
      </PostHogProvider>
    </SessionProvider>
  );
}
