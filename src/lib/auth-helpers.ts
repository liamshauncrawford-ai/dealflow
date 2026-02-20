import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

type AuthResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

type AdminResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

/**
 * Require an authenticated and approved user session.
 * Returns session on success, or a NextResponse error to return immediately.
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Unauthorized — sign in required" },
        { status: 401 },
      ),
    };
  }

  if (!session.user.isApproved) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Forbidden — your account is pending approval" },
        { status: 403 },
      ),
    };
  }

  return { session, error: null };
}

/**
 * Require an authenticated, approved ADMIN user session.
 */
export async function requireAdmin(): Promise<AdminResult> {
  const result = await requireAuth();
  if (result.error) return result;

  if (result.session.user.role !== "ADMIN") {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Forbidden — admin access required" },
        { status: 403 },
      ),
    };
  }

  return result;
}

/**
 * Require EITHER a valid CRON_SECRET Bearer token OR an authenticated user session.
 *
 * Use this for routes that need to be callable both by:
 *   - Railway cron / external schedulers (via Authorization: Bearer <CRON_SECRET>)
 *   - Logged-in dashboard users (via session cookie from "Run Now" / "Seed" buttons)
 *
 * This eliminates the need for proxy-to-self fetch patterns that break behind
 * reverse proxies, load balancers, or when cookies don't forward.
 */
export async function requireCronOrAuth(
  request: Request,
): Promise<{ authorized: true; error: null } | { authorized: false; error: NextResponse }> {
  const CRON_SECRET = process.env.CRON_SECRET;

  // Path 1: CRON_SECRET in Authorization header
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token === CRON_SECRET) {
      return { authorized: true, error: null };
    }
  }

  // Path 2: Valid user session (cookie-based auth from the browser)
  try {
    const session = await auth();
    if (session?.user?.isApproved) {
      return { authorized: true, error: null };
    }

    // Session exists but user not approved
    if (session?.user && !session.user.isApproved) {
      console.warn("[requireCronOrAuth] Session found but user not approved:", session.user.email);
      return {
        authorized: false,
        error: NextResponse.json(
          { error: "Forbidden — account not approved", debug: { hasSession: true, email: session.user.email, isApproved: false } },
          { status: 403 },
        ),
      };
    }

    // No session at all — log for debugging
    console.warn("[requireCronOrAuth] No valid session found. CRON_SECRET set:", !!CRON_SECRET);
  } catch (authError) {
    // auth() threw an error — this can happen if DB is unreachable, AUTH_SECRET missing, etc.
    console.error("[requireCronOrAuth] auth() threw error:", authError);
    return {
      authorized: false,
      error: NextResponse.json(
        {
          error: "Auth check failed",
          debug: {
            message: authError instanceof Error ? authError.message : String(authError),
            hasCronSecret: !!CRON_SECRET,
            hasAuthSecret: !!process.env.AUTH_SECRET,
          },
        },
        { status: 500 },
      ),
    };
  }

  // Path 3: No CRON_SECRET set at all (local dev without secrets)
  if (!CRON_SECRET) {
    return { authorized: true, error: null };
  }

  return {
    authorized: false,
    error: NextResponse.json(
      {
        error: "Unauthorized",
        debug: {
          hasCronSecret: true,
          cronTokenProvided: !!request.headers.get("authorization"),
          sessionResult: "no_session",
        },
      },
      { status: 401 },
    ),
  };
}

/**
 * Get the current auth session, or null if not authenticated.
 * Does NOT enforce approval — useful for pages that need soft auth checks.
 */
export async function getAuthSession(): Promise<Session | null> {
  return await auth();
}
