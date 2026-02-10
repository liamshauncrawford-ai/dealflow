import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight API auth middleware.
 * When API_KEY env var is set, external /api/* requests must include
 * either x-api-key header or ?apiKey= query param.
 * Same-origin requests from the frontend are allowed through.
 * When API_KEY is not set, all requests pass through (dev mode).
 */
export function middleware(request: NextRequest) {
  const apiKey = process.env.API_KEY;

  // No API_KEY configured — skip auth (development mode)
  if (!apiKey) {
    return NextResponse.next();
  }

  // Allow same-origin requests from the frontend (browser navigation & fetch)
  // These have Sec-Fetch-Site: same-origin or a matching Referer/Origin header
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") {
    return NextResponse.next();
  }

  // Also allow requests with a matching Origin or Referer (for older browsers)
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const appUrl = request.nextUrl.origin;
  if (
    (origin && origin === appUrl) ||
    (referer && referer.startsWith(appUrl))
  ) {
    return NextResponse.next();
  }

  // OAuth callback routes must be accessible from external redirects (Google, Azure)
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/email/auth")) {
    return NextResponse.next();
  }

  // Check header first, then query param
  const headerKey = request.headers.get("x-api-key");
  const queryKey = request.nextUrl.searchParams.get("apiKey");

  if (headerKey === apiKey || queryKey === apiKey) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "Unauthorized — provide x-api-key header or apiKey query param" },
    { status: 401 },
  );
}

export const config = {
  matcher: "/api/:path*",
};
