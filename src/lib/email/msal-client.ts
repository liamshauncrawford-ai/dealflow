import {
  ConfidentialClientApplication,
  Configuration,
  AuthorizationUrlRequest,
  AuthorizationCodeRequest,
  RefreshTokenRequest,
} from "@azure/msal-node";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

// ---------------------------------------------------------------------------
// MSAL Singleton
// ---------------------------------------------------------------------------

const SCOPES = ["Mail.Read", "Mail.Send", "User.Read", "offline_access"];

let msalInstance: ConfidentialClientApplication | null = null;

/**
 * Returns a singleton ConfidentialClientApplication configured from env vars.
 */
export function getMsalClient(): ConfidentialClientApplication {
  if (msalInstance) return msalInstance;

  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      "Missing required Azure AD environment variables: " +
        "AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID"
    );
  }

  const config: Configuration = {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  };

  msalInstance = new ConfidentialClientApplication(config);
  return msalInstance;
}

// ---------------------------------------------------------------------------
// Auth URL Generation
// ---------------------------------------------------------------------------

/**
 * Generates the Microsoft OAuth 2.0 authorization URL that the user
 * should be redirected to in order to grant consent.
 */
export async function getAuthUrl(): Promise<string> {
  const redirectUri = process.env.AZURE_AD_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("Missing AZURE_AD_REDIRECT_URI environment variable");
  }

  const client = getMsalClient();

  const authUrlRequest: AuthorizationUrlRequest = {
    scopes: SCOPES,
    redirectUri,
  };

  return client.getAuthCodeUrl(authUrlRequest);
}

// ---------------------------------------------------------------------------
// Token Acquisition — Authorization Code Flow
// ---------------------------------------------------------------------------

/**
 * Exchanges an authorization code (from the OAuth callback) for access and
 * refresh tokens.
 */
export async function acquireTokenByCode(code: string) {
  const redirectUri = process.env.AZURE_AD_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("Missing AZURE_AD_REDIRECT_URI environment variable");
  }

  const client = getMsalClient();

  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: SCOPES,
    redirectUri,
  };

  return client.acquireTokenByCode(tokenRequest);
}

// ---------------------------------------------------------------------------
// Token Acquisition — Silent (cached / refresh token)
// ---------------------------------------------------------------------------

/**
 * Attempts to silently acquire a new access token using the MSAL token cache.
 * Falls back to the refresh token flow when the cache is empty.
 */
export async function acquireTokenSilent(accountId: string) {
  const client = getMsalClient();

  const accounts = await client.getTokenCache().getAllAccounts();
  const account = accounts.find((a) => a.homeAccountId === accountId);

  if (!account) {
    return null;
  }

  return client.acquireTokenSilent({
    scopes: SCOPES,
    account,
  });
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
 * returns a valid access token.  If the current token is expired (or within
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
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const now = new Date();
  const expiresAt = new Date(account.tokenExpiresAt);

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token is still fresh — return it directly.
    return decryptedAccessToken;
  }

  // Token is expired or about to expire — refresh it.
  const client = getMsalClient();

  const refreshRequest: RefreshTokenRequest = {
    refreshToken: decryptedRefreshToken,
    scopes: SCOPES,
  };

  const result = await client.acquireTokenByRefreshToken(refreshRequest);

  if (!result || !result.accessToken) {
    // Mark the account as disconnected so the user knows to re-authenticate.
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { isConnected: false },
    });
    throw new Error(
      `Failed to refresh access token for EmailAccount: ${emailAccountId}. ` +
        "The account has been marked as disconnected."
    );
  }

  // Compute new expiration from the expiresOn date provided by MSAL, falling
  // back to 1 hour from now if not available.
  const newExpiresAt = result.expiresOn
    ? new Date(result.expiresOn)
    : new Date(Date.now() + 60 * 60 * 1000);

  // MSAL may or may not return a new refresh token — fall back to the
  // existing one if none is provided.
  const newRefreshToken =
    (result as Record<string, unknown>).refreshToken as string | undefined ??
    decryptedRefreshToken;

  await saveTokensToDb(
    account.email,
    account.displayName,
    result.accessToken,
    newRefreshToken,
    newExpiresAt
  );

  return result.accessToken;
}
