import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get recent scrape runs (last 20)
    const recentRuns = await prisma.scrapeRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get currently running scrapes
    const runningRuns = await prisma.scrapeRun.findMany({
      where: { status: "RUNNING" },
    });

    // Get scrape schedules
    const schedules = await prisma.scrapeSchedule.findMany({
      orderBy: { platform: "asc" },
    });

    return NextResponse.json({
      recentRuns,
      runningRuns,
      schedules,
    });
  } catch (error) {
    console.error("Error fetching scraping status:", error);
    return NextResponse.json(
      { error: "Failed to fetch scraping status" },
      { status: 500 }
    );
  }
}
