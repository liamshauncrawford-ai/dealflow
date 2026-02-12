import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/email/auth/callback/debug
 *
 * Diagnostic endpoint to debug the OAuth callback 500 error.
 * Tests each module import and dependency individually.
 */
export async function GET(request: NextRequest) {
  const results: Record<string, string> = {};

  // 1. Test basic response
  results["basic"] = "ok";

  // 2. Test env vars
  results["ENCRYPTION_KEY"] = process.env.ENCRYPTION_KEY ? "set" : "MISSING";
  results["NEXT_PUBLIC_APP_URL"] = process.env.NEXT_PUBLIC_APP_URL || "MISSING";
  results["AZURE_AD_CLIENT_ID"] = process.env.AZURE_AD_CLIENT_ID ? "set" : "MISSING";
  results["AZURE_AD_CLIENT_SECRET"] = process.env.AZURE_AD_CLIENT_SECRET ? "set" : "MISSING";
  results["AZURE_AD_TENANT_ID"] = process.env.AZURE_AD_TENANT_ID ? "set" : "MISSING";
  results["AZURE_AD_REDIRECT_URI"] = process.env.AZURE_AD_REDIRECT_URI || "MISSING";
  results["GOOGLE_CLIENT_ID"] = process.env.GOOGLE_CLIENT_ID ? "set" : "MISSING";
  results["GOOGLE_CLIENT_SECRET"] = process.env.GOOGLE_CLIENT_SECRET ? "set" : "MISSING";
  results["GOOGLE_REDIRECT_URI"] = process.env.GOOGLE_REDIRECT_URI || "MISSING";
  results["DATABASE_URL"] = process.env.DATABASE_URL ? "set" : "MISSING";

  // 3. Test Prisma import
  try {
    const db = await import("@/lib/db");
    results["prisma_import"] = db.prisma ? "ok" : "imported but prisma is falsy";
  } catch (err) {
    results["prisma_import"] = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 4. Test encryption import
  try {
    const enc = await import("@/lib/encryption");
    results["encryption_import"] = typeof enc.encrypt === "function" ? "ok" : "imported but encrypt is not a function";
  } catch (err) {
    results["encryption_import"] = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 5. Test gmail-client import
  try {
    const gmail = await import("@/lib/email/gmail-client");
    results["gmail_client_import"] = typeof gmail.exchangeCodeForTokens === "function" ? "ok" : "imported but function missing";
  } catch (err) {
    results["gmail_client_import"] = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 6. Test msal-client import
  try {
    const msal = await import("@/lib/email/msal-client");
    results["msal_client_import"] = typeof msal.acquireTokenByCode === "function" ? "ok" : "imported but function missing";
  } catch (err) {
    results["msal_client_import"] = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 7. Test encrypt function actually works
  try {
    const { encrypt, decrypt } = await import("@/lib/encryption");
    const testEncrypted = encrypt("test_value");
    const testDecrypted = decrypt(testEncrypted);
    results["encryption_roundtrip"] = testDecrypted === "test_value" ? "ok" : "mismatch";
  } catch (err) {
    results["encryption_roundtrip"] = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 8. Test DB connection
  try {
    const { prisma } = await import("@/lib/db");
    const count = await prisma.emailAccount.count();
    results["db_connection"] = `ok (${count} email accounts)`;
  } catch (err) {
    results["db_connection"] = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(results, { status: 200 });
}
