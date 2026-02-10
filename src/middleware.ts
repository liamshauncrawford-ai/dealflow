import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight API auth middleware.
 * When API_KEY env var is set, all /api/* requests must include
 * either x-api-key header or ?apiKey= query param.
 * When API_KEY is not set, all requests pass through (dev mode).
 */
export function middleware(request: NextRequest) {
  const apiKey = process.env.API_KEY;

  // No API_KEY configured — skip auth (development mode)
  if (!apiKey) {
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
