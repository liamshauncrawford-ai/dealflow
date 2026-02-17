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
 * Get the current auth session, or null if not authenticated.
 * Does NOT enforce approval — useful for pages that need soft auth checks.
 */
export async function getAuthSession(): Promise<Session | null> {
  return await auth();
}
