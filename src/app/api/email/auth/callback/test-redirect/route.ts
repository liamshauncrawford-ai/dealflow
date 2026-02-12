import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/email/auth/callback/test-redirect
 *
 * Tests if NextResponse.redirect() works from this route path.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const base = host && !host.includes("localhost") ? `${proto}://${host}` : "http://localhost:3000";

  return NextResponse.redirect(
    new URL("/settings/email?error=test_redirect_works", base)
  );
}
