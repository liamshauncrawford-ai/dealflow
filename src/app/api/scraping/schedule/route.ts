import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Platform } from "@prisma/client";

export async function GET() {
  try {
    const schedules = await prisma.scrapeSchedule.findMany({
      orderBy: { platform: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.platform) {
      return NextResponse.json(
        { error: "platform is required" },
        { status: 400 }
      );
    }

    const schedule = await prisma.scrapeSchedule.upsert({
      where: { platform: body.platform as Platform },
      update: {
        cronExpression: body.cronExpression ?? undefined,
        isEnabled: body.isEnabled ?? undefined,
      },
      create: {
        platform: body.platform as Platform,
        cronExpression: body.cronExpression || "0 6 * * *",
        isEnabled: body.isEnabled ?? false,
      },
    });

    return NextResponse.json(schedule);
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}
