import { NextRequest, NextResponse } from "next/server";

/**
 * Combined authentication middleware (Edge-compatible — no Prisma).
 *
 * Checks for the session cookie presence only. Actual session validation
 * (role, approval status) happens in server components / API routes
 * where PrismaClient can run in the Node.js runtime.
 *
 * 1. Public routes — always accessible
 * 2. API routes with API_KEY — bypass session check
 * 3. Unauthenticated — redirect to /login (pages) or 401 (API)
 * 4. Authenticated — pass through (approval checks happen server-side)
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // ── 3. Check for session cookie ──
  // NextAuth v5 uses "__Secure-authjs.session-token" in production (HTTPS)
  // and "authjs.session-token" in development (HTTP)
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("authjs.session-token")?.value;

  if (!sessionToken) {
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

  // ── 4. Authenticated — pass through ──
  // Approval status check is done server-side in layouts/API routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static assets and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
