import { CABLING_VALUE_BY_MW } from "@/lib/market-intel-constants";

const EARTH_RADIUS_MI = 3958.8;

/** Haversine distance in miles between two lat/lng points */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a));
}

/** Proximity score (0-10) based on distance in miles */
export function proximityScore(distanceMi: number): number {
  if (distanceMi < 5) return 10;
  if (distanceMi < 10) return 8;
  if (distanceMi < 15) return 6;
  if (distanceMi < 25) return 4;
  return 0;
}

/** Estimate cabling value midpoint from facility MW, using thesis constants */
export function estimateCablingValueFromMW(mw: number): number {
  const tier = CABLING_VALUE_BY_MW.find((t) => mw >= t.minMW && mw <= t.maxMW);
  if (!tier) {
    if (mw < 2) return 125_000; // midpoint of 50K-200K
    return 10_000_000; // midpoint of 5M-15M
  }
  return (tier.low + tier.high) / 2;
}

/** Convert miles to meters (for Google Maps Circle radius) */
export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}
