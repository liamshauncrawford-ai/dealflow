import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health
 *
 * Health check endpoint for Railway uptime monitoring.
 * Validates database connectivity, critical env vars, and deploy version.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};

  // 1. Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  // 2. Critical environment variables
  checks.auth_secret = process.env.AUTH_SECRET ? "ok" : "fail";
  checks.encryption_key = process.env.ENCRYPTION_KEY ? "ok" : "fail";
  checks.database_url = process.env.DATABASE_URL ? "ok" : "fail";
  checks.cron_secret = process.env.CRON_SECRET ? "ok" : "fail";
  checks.nextauth_url = process.env.NEXTAUTH_URL ? "ok" : "fail";

  const allHealthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      checks,
      // Deploy marker — when you hit /api/health, this confirms which version is live
      version: "2026-02-20-maps-env-rebuild-v6",
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  );
}
