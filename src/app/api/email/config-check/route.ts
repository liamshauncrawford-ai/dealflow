import { NextResponse } from "next/server";

export async function GET() {
  const gmailConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  const microsoftConfigured = Boolean(
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET &&
    process.env.AZURE_AD_TENANT_ID
  );

  return NextResponse.json({
    gmail: gmailConfigured,
    microsoft: microsoftConfigured,
    anyConfigured: gmailConfigured || microsoftConfigured,
  });
}
