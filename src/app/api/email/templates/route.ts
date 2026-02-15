import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createTemplateSchema } from "@/lib/validations/email";

/**
 * GET /api/email/templates
 * List all email templates, ordered by category then name.
 */
export async function GET() {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/email/templates
 * Create a new email template.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const template = await prisma.emailTemplate.create({
      data: parsed.data,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
