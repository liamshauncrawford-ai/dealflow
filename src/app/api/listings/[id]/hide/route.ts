import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findUnique({
      where: { id },
      select: { isHidden: true },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { isHidden: !listing.isHidden },
    });

    return NextResponse.json({
      id: updated.id,
      isHidden: updated.isHidden,
    });
  } catch (error) {
    console.error("Error toggling listing visibility:", error);
    return NextResponse.json(
      { error: "Failed to toggle listing visibility" },
      { status: 500 }
    );
  }
}
