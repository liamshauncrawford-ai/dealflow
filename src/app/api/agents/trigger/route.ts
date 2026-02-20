import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Known cron endpoints that the dashboard is allowed to trigger.
 * Acts as an allowlist — prevents arbitrary internal URL forwarding.
 */
const ALLOWED_ENDPOINTS = [
  "/api/cron/daily-scan",
  "/api/cron/news-monitor",
  "/api/cron/market-pulse",
  "/api/cron/csos-scan",
  "/api/cron/dora-scan",
  "/api/cron/dedup-scan",
  "/api/cron/market-metrics",
];

/**
 * POST /api/agents/trigger
 *
 * Server-side proxy that forwards agent trigger requests to cron endpoints
 * with the CRON_SECRET attached. This keeps the secret out of the browser
 * while letting the Agent Dashboard trigger agents via "Run Now".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { endpoint } = body as { endpoint?: string };

    if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
      return NextResponse.json(
        { error: "Invalid or unrecognized agent endpoint" },
        { status: 400 },
      );
    }

    // Build the absolute URL for the internal fetch
    const baseUrl = request.nextUrl.origin;
    const targetUrl = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Attach CRON_SECRET if configured
    if (CRON_SECRET) {
      headers["Authorization"] = `Bearer ${CRON_SECRET}`;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ force: false }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Agent trigger failed", detail: data.detail },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Agent trigger proxy error:", error);
    return NextResponse.json(
      { error: "Failed to trigger agent" },
      { status: 500 },
    );
  }
}
