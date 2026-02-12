import { NextRequest, NextResponse } from "next/server";

/** Resolve the public base URL for redirects (avoids 0.0.0.0 in production). */
function baseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.nextUrl.protocol}//${request.headers.get("host")}`
  );
}

/**
 * GET /api/email/auth/callback?code=XXX
 *
 * Handles OAuth callbacks from both Google and Microsoft.
 * Detects the provider by checking for the `scope` parameter
 * (Google includes googleapis.com scopes in the callback URL).
 */
export async function GET(request: NextRequest) {
  const base = baseUrl(request);

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
      return handleGoogleCallback(code, base);
    } else {
      return handleMicrosoftCallback(code, base);
    }
  } catch (err) {
    console.error("Error handling OAuth callback:", err);
    return NextResponse.redirect(
      new URL(
        `/settings/email?error=${encodeURIComponent(
          err instanceof Error ? err.message : "callback_failed"
        )}`,
        base
      )
    );
  }
}

// ── Google OAuth callback ──────────────────────────

async function handleGoogleCallback(code: string, base: string) {
  // Dynamic import to avoid loading MSAL when only Google is needed
  const { exchangeCodeForTokens, getGoogleUserProfile, saveGmailTokensToDb } =
    await import("@/lib/email/gmail-client");

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
  // Dynamic import — no heavy SDK, just our pure-HTTP client
  const { acquireTokenByCode, saveTokensToDb } =
    await import("@/lib/email/msal-client");

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
