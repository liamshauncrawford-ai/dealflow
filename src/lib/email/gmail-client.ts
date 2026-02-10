/**
 * Gmail OAuth2 client — follows the same pattern as msal-client.ts.
 *
 * Handles:
 *  - OAuth2 authorization URL generation
 *  - Authorization code exchange for tokens
 *  - Token refresh with 5-minute buffer
 *  - Encrypted token storage in EmailAccount table
 */

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth config. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

// ─────────────────────────────────────────────
// OAuth2 URL generation
// ─────────────────────────────────────────────

/**
 * Generate the Google OAuth2 authorization URL.
 */
export function getGmailAuthUrl(): string {
  const { clientId, redirectUri } = getGoogleConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // Force consent to always get refresh token
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─────────────────────────────────────────────
// Token exchange
// ─────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────
// User profile
// ─────────────────────────────────────────────

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Fetch the authenticated user's profile.
 */
export async function getGoogleUserProfile(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user profile: ${response.status}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────
// Token storage
// ─────────────────────────────────────────────

/**
 * Save (upsert) Gmail tokens to the database with encryption.
 */
export async function saveGmailTokensToDb(
  email: string,
  displayName: string | null,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);

  await prisma.emailAccount.upsert({
    where: { email },
    create: {
      email,
      displayName,
      provider: "GMAIL",
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      isConnected: true,
    },
    update: {
      displayName,
      provider: "GMAIL",
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      isConnected: true,
    },
  });
}

// ─────────────────────────────────────────────
// Token refresh
// ─────────────────────────────────────────────

/**
 * Get a valid Gmail access token, refreshing if needed.
 * Uses a 5-minute buffer before expiry.
 */
export async function getValidGmailAccessToken(
  emailAccountId: string
): Promise<string> {
  const account = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
  });

  if (!account) {
    throw new Error(`EmailAccount not found: ${emailAccountId}`);
  }

  if (!account.isConnected) {
    throw new Error(`EmailAccount is disconnected: ${emailAccountId}`);
  }

  if (account.provider !== "GMAIL") {
    throw new Error(`EmailAccount is not a Gmail account: ${emailAccountId}`);
  }

  // Check if token expires within 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (account.tokenExpiresAt > fiveMinutesFromNow) {
    // Token is still valid
    return decrypt(account.accessToken);
  }

  // Token is stale — refresh it
  try {
    const { clientId, clientSecret } = getGoogleConfig();
    const decryptedRefreshToken = decrypt(account.refreshToken);

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptedRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[gmail] Token refresh failed: ${error}`);

      // Mark account as disconnected
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: { isConnected: false },
      });

      throw new Error(`Gmail token refresh failed: ${response.status}`);
    }

    const tokenData: GoogleTokenResponse = await response.json();

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    const encryptedAccessToken = encrypt(tokenData.access_token);

    // Update tokens in DB (refresh token doesn't change on refresh for Google)
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        accessToken: encryptedAccessToken,
        tokenExpiresAt: newExpiresAt,
        // Google may or may not return a new refresh token
        ...(tokenData.refresh_token
          ? { refreshToken: encrypt(tokenData.refresh_token) }
          : {}),
      },
    });

    return tokenData.access_token;
  } catch (err) {
    if (err instanceof Error && err.message.includes("Token refresh failed")) {
      throw err;
    }

    console.error(`[gmail] Token refresh error:`, err);

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { isConnected: false },
    });

    throw new Error(
      `Gmail token refresh failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
