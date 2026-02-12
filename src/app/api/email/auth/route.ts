import { NextRequest, NextResponse } from "next/server";
import { getGmailAuthUrl } from "@/lib/email/gmail-client";
import { getAuthUrl } from "@/lib/email/msal-client";

/** Resolve the public base URL for redirects (avoids 0.0.0.0 in production). */
function baseUrl(request: NextRequest): string {
  const host = request.headers.get("host");
  if (host && !host.includes("localhost") && !host.includes("0.0.0.0")) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    `${request.nextUrl.protocol}//${host}`
  );
}

/**
 * GET /api/email/auth?provider=microsoft|gmail
 *
 * Initiates the OAuth 2.0 authorization code flow for the specified provider.
 * Defaults to Microsoft if no provider is specified.
 */
export async function GET(request: NextRequest) {
  const base = baseUrl(request);

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
          new URL(`/settings/email?error=${errorMsg}`, base)
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
          new URL(`/settings/email?error=${errorMsg}`, base)
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
      new URL(`/settings/email?error=${errorMsg}`, base)
    );
  }
}
