import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getGoogleUserProfile,
  saveGmailTokensToDb,
} from "@/lib/email/gmail-client";
import {
  acquireTokenByCode,
  saveTokensToDb,
} from "@/lib/email/msal-client";

/**
 * GET /api/email/auth/callback?code=XXX
 *
 * Handles OAuth callbacks from both Google and Microsoft.
 * Detects the provider by checking for the `scope` parameter
 * (Google includes googleapis.com scopes in the callback URL).
 */
export async function GET(request: NextRequest) {
  // Build the base URL from the request headers (not NEXT_PUBLIC_ which is build-time inlined)
  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const base = host.includes("localhost") || host.includes("0.0.0.0")
    ? `http://${host}`
    : `${proto}://${host}`;

  // Wrap EVERYTHING in a single try/catch that returns JSON on error
  // so we can diagnose issues in production
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const scope = searchParams.get("scope") || "";

    // Handle OAuth errors returned by either provider.
    if (error) {
      console.error("OAuth error:", error, errorDescription ?? "");
      return NextResponse.redirect(
        new URL(
          `/settings/email?error=${encodeURIComponent(errorDescription || error)}`,
          base
        )
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/settings/email?error=missing_code", base)
      );
    }

    // Detect provider: Google callbacks include googleapis.com scopes
    const isGoogle = scope.includes("googleapis.com") || scope.includes("google");

    if (isGoogle) {
      return await handleGoogleCallback(code, base);
    } else {
      return await handleMicrosoftCallback(code, base);
    }
  } catch (err) {
    // Return JSON error so we can see what's happening in production
    console.error("Error handling OAuth callback:", err);
    const message = err instanceof Error ? err.message : "callback_failed";
    const stack = err instanceof Error ? err.stack : undefined;

    // Try to redirect, but if that fails too, return JSON
    try {
      return NextResponse.redirect(
        new URL(
          `/settings/email?error=${encodeURIComponent(message.substring(0, 200))}`,
          base
        )
      );
    } catch (redirectErr) {
      // If even the redirect fails, return JSON so we can debug
      return NextResponse.json(
        {
          error: "OAuth callback failed",
          message,
          stack,
          redirectError: redirectErr instanceof Error ? redirectErr.message : String(redirectErr),
          base,
        },
        { status: 500 }
      );
    }
  }
}

// ── Google OAuth callback ──────────────────────────

async function handleGoogleCallback(code: string, base: string) {
  // Exchange code for tokens
  const tokenData = await exchangeCodeForTokens(code);

  if (!tokenData.access_token) {
    return NextResponse.redirect(
      new URL("/settings/email?error=google_token_exchange_failed", base)
    );
  }

  // Fetch user profile
  const profile = await getGoogleUserProfile(tokenData.access_token);

  if (!profile.email) {
    return NextResponse.redirect(
      new URL("/settings/email?error=google_no_email", base)
    );
  }

  // Check for refresh token
  if (!tokenData.refresh_token) {
    console.error("No refresh token returned by Google. Ensure prompt=consent and access_type=offline.");
    return NextResponse.redirect(
      new URL("/settings/email?error=no_refresh_token", base)
    );
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Save encrypted tokens to database
  await saveGmailTokensToDb(
    profile.email,
    profile.name || null,
    tokenData.access_token,
    tokenData.refresh_token,
    expiresAt
  );

  return NextResponse.redirect(
    new URL("/settings/email?connected=true", base)
  );
}

// ── Microsoft OAuth callback ───────────────────────

async function handleMicrosoftCallback(code: string, base: string) {
  // Exchange the authorization code for tokens.
  const tokenResponse = await acquireTokenByCode(code);

  if (!tokenResponse || !tokenResponse.accessToken) {
    return NextResponse.redirect(
      new URL("/settings/email?error=token_exchange_failed", base)
    );
  }

  const { accessToken, refreshToken, expiresOn } = tokenResponse;

  // Fetch the user profile from Microsoft Graph.
  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    console.error(
      "Failed to fetch Microsoft Graph profile:",
      profileRes.status,
      await profileRes.text()
    );
    return NextResponse.redirect(
      new URL("/settings/email?error=profile_fetch_failed", base)
    );
  }

  const profile = await profileRes.json();
  const email: string =
    profile.mail || profile.userPrincipalName || profile.id;
  const displayName: string | null = profile.displayName ?? null;

  if (!refreshToken) {
    console.error(
      "No refresh token returned by Microsoft. Ensure offline_access scope is requested."
    );
    return NextResponse.redirect(
      new URL("/settings/email?error=no_refresh_token", base)
    );
  }

  await saveTokensToDb(email, displayName, accessToken, refreshToken, expiresOn);

  return NextResponse.redirect(
    new URL("/settings/email?connected=true", base)
  );
}
