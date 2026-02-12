/**
 * Microsoft OAuth2 client — pure HTTP implementation (no @azure/msal-node).
 *
 * Uses standard OAuth2 endpoints from Microsoft identity platform directly,
 * matching the pattern used by gmail-client.ts. This avoids dependency issues
 * with @azure/msal-node in Next.js standalone Docker builds.
 *
 * Handles:
 *  - OAuth2 authorization URL generation
 *  - Authorization code exchange for tokens
 *  - Token refresh with 5-minute buffer
 *  - Encrypted token storage in EmailAccount table
 */

import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SCOPES = ["Mail.Read", "Mail.Send", "User.Read", "offline_access"];

function getMicrosoftConfig() {
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const redirectUri = process.env.AZURE_AD_REDIRECT_URI;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      "Missing required Azure AD environment variables: " +
        "AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID"
    );
  }

  const authority = `https://login.microsoftonline.com/${tenantId}`;

  return { clientId, clientSecret, tenantId, redirectUri, authority };
}

// ---------------------------------------------------------------------------
// Auth URL Generation
// ---------------------------------------------------------------------------

/**
 * Generates the Microsoft OAuth 2.0 authorization URL.
 */
export async function getAuthUrl(): Promise<string> {
  const { clientId, redirectUri, authority } = getMicrosoftConfig();

  if (!redirectUri) {
    throw new Error("Missing AZURE_AD_REDIRECT_URI environment variable");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    prompt: "consent",
  });

  return `${authority}/oauth2/v2.0/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token Exchange — Authorization Code Flow
// ---------------------------------------------------------------------------

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

/**
 * Exchanges an authorization code for access + refresh tokens.
 */
export async function acquireTokenByCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresOn: Date;
}> {
  const { clientId, clientSecret, redirectUri, authority } =
    getMicrosoftConfig();

  if (!redirectUri) {
    throw new Error("Missing AZURE_AD_REDIRECT_URI environment variable");
  }

  const response = await fetch(`${authority}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: SCOPES.join(" "),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Microsoft token exchange failed: ${response.status} - ${errorText}`
    );
  }

  const data: MicrosoftTokenResponse = await response.json();
  const expiresOn = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresOn,
  };
}

// ---------------------------------------------------------------------------
// Database — Save / Upsert Tokens
// ---------------------------------------------------------------------------

/**
 * Encrypts access & refresh tokens and upserts them into the EmailAccount
 * table keyed by email address.
 */
export async function saveTokensToDb(
  email: string,
  displayName: string | null,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
) {
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = encrypt(refreshToken);

  await prisma.emailAccount.upsert({
    where: { email },
    create: {
      email,
      displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      isConnected: true,
    },
    update: {
      displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      isConnected: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Database — Get Valid (non-expired) Access Token
// ---------------------------------------------------------------------------

/**
 * Reads the EmailAccount from the database, decrypts the stored tokens, and
 * returns a valid access token. If the current token is expired (or within
 * 5 minutes of expiry) it is refreshed automatically using the refresh token
 * and the new tokens are persisted back to the database.
 */
export async function getValidAccessToken(
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

  const decryptedAccessToken = decrypt(account.accessToken);
  const decryptedRefreshToken = decrypt(account.refreshToken);

  // Check whether the current token is still valid (with a 5-minute buffer).
  const bufferMs = 5 * 60 * 1000;
  const now = new Date();
  const expiresAt = new Date(account.tokenExpiresAt);

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return decryptedAccessToken;
  }

  // Token is expired or about to expire — refresh it.
  try {
    const { clientId, clientSecret, authority } = getMicrosoftConfig();

    const response = await fetch(`${authority}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptedRefreshToken,
        grant_type: "refresh_token",
        scope: SCOPES.join(" "),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[microsoft] Token refresh failed: ${errorText}`);

      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: { isConnected: false },
      });

      throw new Error(`Microsoft token refresh failed: ${response.status}`);
    }

    const data: MicrosoftTokenResponse = await response.json();
    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Microsoft may or may not return a new refresh token
    const newRefreshToken = data.refresh_token ?? decryptedRefreshToken;

    await saveTokensToDb(
      account.email,
      account.displayName,
      data.access_token,
      newRefreshToken,
      newExpiresAt
    );

    return data.access_token;
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Token refresh failed")
    ) {
      throw err;
    }

    console.error("[microsoft] Token refresh error:", err);

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { isConnected: false },
    });

    throw new Error(
      `Microsoft token refresh failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
