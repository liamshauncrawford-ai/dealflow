import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { createFacilitySchema } from "@/lib/validations/market-intel";

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createFacilitySchema, request);
    if (parsed.error) return parsed.error;

    const facility = await prisma.dCFacility.create({
      data: parsed.data,
      include: {
        operator: { select: { id: true, name: true } },
        generalContractor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(facility, { status: 201 });
  } catch (error) {
    console.error("Error creating facility:", error);
    return NextResponse.json({ error: "Failed to create facility" }, { status: 500 });
  }
}
