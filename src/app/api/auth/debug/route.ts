import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Diagnostic endpoint to test if the PrismaAdapter can access all required tables.
 * GET /api/auth/debug
 */
export async function GET() {
  const results: Record<string, string> = {};

  // Test each table the adapter needs
  try {
    const userCount = await prisma.user.count();
    results.user = `OK (${userCount} rows)`;
  } catch (e: unknown) {
    results.user = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const accountCount = await prisma.account.count();
    results.account = `OK (${accountCount} rows)`;
  } catch (e: unknown) {
    results.account = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const sessionCount = await prisma.session.count();
    results.session = `OK (${sessionCount} rows)`;
  } catch (e: unknown) {
    results.session = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const vtCount = await prisma.verificationToken.count();
    results.verificationToken = `OK (${vtCount} rows)`;
  } catch (e: unknown) {
    results.verificationToken = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const arCount = await prisma.accessRequest.count();
    results.accessRequest = `OK (${arCount} rows)`;
  } catch (e: unknown) {
    results.accessRequest = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const lhCount = await prisma.loginHistory.count();
    results.loginHistory = `OK (${lhCount} rows)`;
  } catch (e: unknown) {
    results.loginHistory = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test creating and deleting a test user (what the adapter does)
  try {
    const testUser = await prisma.user.create({
      data: {
        name: "__test_user__",
        email: "__test__@__test__.com",
      },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
    results.createDeleteUser = "OK";
  } catch (e: unknown) {
    results.createDeleteUser = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Check environment
  results.AUTH_SECRET = process.env.AUTH_SECRET ? "SET" : "MISSING";
  results.AUTH_URL = process.env.AUTH_URL || "MISSING";
  results.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ? "SET" : "MISSING";
  results.AZURE_AD_CLIENT_ID = process.env.AZURE_AD_CLIENT_ID ? "SET" : "MISSING";
  results.DATABASE_URL = process.env.DATABASE_URL ? "SET (hidden)" : "MISSING";

  return NextResponse.json(results, { status: 200 });
}
