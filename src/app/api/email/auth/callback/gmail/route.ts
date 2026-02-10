import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getGoogleUserProfile,
  saveGmailTokensToDb,
} from "@/lib/email/gmail-client";

/** Resolve the public base URL for redirects (avoids 0.0.0.0 in production). */
function baseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.nextUrl.protocol}//${request.headers.get("host")}`
  );
}

/**
 * GET /api/email/auth/callback/gmail?code=XXX
 *
 * Google redirects the user here after OAuth consent.
 * We exchange the code for tokens, fetch the user profile,
 * encrypt and persist the tokens, then redirect to settings.
 */
export async function GET(request: NextRequest) {
  const base = baseUrl(request);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(
        new URL(
          `/settings/email?error=${encodeURIComponent(error)}`,
          base
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/settings/email?error=missing_code", base)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);

    if (!tokenResponse.access_token) {
      return NextResponse.redirect(
        new URL("/settings/email?error=token_exchange_failed", base)
      );
    }

    // Fetch user profile
    const profile = await getGoogleUserProfile(tokenResponse.access_token);

    if (!profile.email) {
      return NextResponse.redirect(
        new URL("/settings/email?error=profile_fetch_failed", base)
      );
    }

    // Compute expiration
    const expiresAt = new Date(
      Date.now() + tokenResponse.expires_in * 1000
    );

    // Ensure we have a refresh token
    if (!tokenResponse.refresh_token) {
      console.error(
        "No refresh token returned by Google. Ensure access_type=offline and prompt=consent."
      );
      return NextResponse.redirect(
        new URL("/settings/email?error=no_refresh_token", base)
      );
    }

    // Persist encrypted tokens
    await saveGmailTokensToDb(
      profile.email,
      profile.name ?? null,
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      expiresAt
    );

    return NextResponse.redirect(
      new URL("/settings/email?connected=true", base)
    );
  } catch (err) {
    console.error("Error handling Gmail OAuth callback:", err);
    const message = err instanceof Error ? err.message : "callback_failed";
    return NextResponse.redirect(
      new URL(`/settings/email?error=${encodeURIComponent(message)}`, base)
    );
  }
}
