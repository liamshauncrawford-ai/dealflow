import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/email/msal-client";
import { getGmailAuthUrl } from "@/lib/email/gmail-client";

/**
 * GET /api/email/auth?provider=microsoft|gmail
 *
 * Initiates the OAuth 2.0 authorization code flow for the specified provider.
 * Defaults to Microsoft if no provider is specified.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider") ?? "microsoft";

    let authUrl: string;

    if (provider === "gmail") {
      // Check if Google OAuth is configured before attempting
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_REDIRECT_URI
      ) {
        const errorMsg = encodeURIComponent(
          "Gmail not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your .env file."
        );
        return NextResponse.redirect(
          new URL(`/settings/email?error=${errorMsg}`, request.url)
        );
      }
      authUrl = getGmailAuthUrl();
    } else {
      // Check if Microsoft OAuth is configured before attempting
      if (
        !process.env.AZURE_AD_CLIENT_ID ||
        !process.env.AZURE_AD_CLIENT_SECRET ||
        !process.env.AZURE_AD_TENANT_ID
      ) {
        const errorMsg = encodeURIComponent(
          "Microsoft 365 not configured. Set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID in your .env file."
        );
        return NextResponse.redirect(
          new URL(`/settings/email?error=${errorMsg}`, request.url)
        );
      }
      authUrl = await getAuthUrl();
    }

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error generating auth URL:", error);
    const errorMsg = encodeURIComponent(
      error instanceof Error ? error.message : "Failed to start authentication"
    );
    return NextResponse.redirect(
      new URL(`/settings/email?error=${errorMsg}`, request.url)
    );
  }
}
