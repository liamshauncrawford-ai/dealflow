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
 * GET /api/email/auth/callback/test?code=XXX
 *
 * Minimal test version of the OAuth callback that wraps everything
 * in error-catching and returns JSON instead of redirects.
 */
export async function GET(request: NextRequest) {
  const steps: Record<string, string> = {};

  try {
    steps["step_1_parse_url"] = "starting";
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code") || "no_code";
    const scope = searchParams.get("scope") || "";
    steps["step_1_parse_url"] = `ok - code=${code.substring(0, 10)}..., scope=${scope}`;

    const isGoogle = scope.includes("googleapis.com") || scope.includes("google");
    steps["provider"] = isGoogle ? "google" : "microsoft";

    if (isGoogle) {
      steps["step_2_exchange"] = "starting google exchange";
      try {
        const tokenData = await exchangeCodeForTokens(code);
        steps["step_2_exchange"] = `ok - has_access=${!!tokenData.access_token}, has_refresh=${!!tokenData.refresh_token}`;
      } catch (e) {
        steps["step_2_exchange"] = `error (expected with test code): ${e instanceof Error ? e.message : String(e)}`;
      }
    } else {
      steps["step_2_exchange"] = "starting microsoft exchange";
      try {
        const tokenResponse = await acquireTokenByCode(code);
        steps["step_2_exchange"] = `ok - has_access=${!!tokenResponse.accessToken}`;
      } catch (e) {
        steps["step_2_exchange"] = `error (expected with test code): ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // Test redirect URL construction
    steps["step_3_redirect"] = "testing redirect construction";
    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const base = host && !host.includes("localhost") ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    steps["base_url"] = base;

    const redirectUrl = new URL("/settings/email?error=test_error", base);
    steps["step_3_redirect"] = `ok - would redirect to: ${redirectUrl.toString()}`;

    return NextResponse.json(steps, { status: 200 });
  } catch (err) {
    steps["fatal_error"] = err instanceof Error
      ? `${err.message}\n${err.stack}`
      : String(err);
    return NextResponse.json(steps, { status: 500 });
  }
}
