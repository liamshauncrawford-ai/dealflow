"use client";

import { APIProvider } from "@vis.gl/react-google-maps";

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
const MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "";

/**
 * Wraps children with the Google Maps APIProvider.
 * Gracefully degrades: if no API key is set, renders a placeholder instead.
 */
export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  if (!MAPS_API_KEY) {
    return <>{children}</>;
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY}>
      {children}
    </APIProvider>
  );
}

/** Check if Google Maps is configured */
export function isMapsConfigured(): boolean {
  return !!MAPS_API_KEY;
}

/** Get the Map ID for AdvancedMarker support */
export function getMapId(): string | undefined {
  return MAPS_MAP_ID || undefined;
}
