import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Combined authentication middleware:
 *
 * 1. Public routes — always accessible (login, access-request, NextAuth API, static assets)
 * 2. API routes with API_KEY — bypass session auth (cron jobs, external integrations)
 * 3. API routes — require valid session + approved user, or return 401/403
 * 4. Dashboard pages — require valid session + approved user, or redirect to /login
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  // ── 1. Public routes — always pass through ──
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/access-request") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/email/auth") // Email OAuth callback routes
  ) {
    return NextResponse.next();
  }

  // ── 2. API_KEY fallback for external/cron access ──
  if (pathname.startsWith("/api/")) {
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      const headerKey = request.headers.get("x-api-key");
      const queryKey = request.nextUrl.searchParams.get("apiKey");
      if (headerKey === apiKey || queryKey === apiKey) {
        return NextResponse.next();
      }
    }
  }

  // ── 3. Not authenticated ──
  if (!session?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized — sign in required" },
        { status: 401 },
      );
    }
    // Page request — redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 4. Authenticated but not approved ──
  if (!session.user.isApproved) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Forbidden — your account is pending approval" },
        { status: 403 },
      );
    }
    // Page request — redirect to access-request
    if (!pathname.startsWith("/access-request")) {
      return NextResponse.redirect(new URL("/access-request", request.url));
    }
  }

  // ── 5. Authenticated + Approved — allow through ──
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
