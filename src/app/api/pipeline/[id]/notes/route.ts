import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBody } from "@/lib/validations/common";
import { createNoteSchema } from "@/lib/validations/pipeline";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notes = await prisma.note.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(createNoteSchema, request);
    if (parsed.error) return parsed.error;

    const note = await prisma.note.create({
      data: {
        content: parsed.data.content,
        opportunityId: id,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
