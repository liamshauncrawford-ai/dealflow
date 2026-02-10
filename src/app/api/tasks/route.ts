import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseBody, parseSearchParams } from "@/lib/validations/common";

const tasksQuerySchema = z.object({
  opportunityId: z.string().optional(),
  status: z.enum(["all", "pending", "completed", "overdue"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

const createTaskSchema = z.object({
  opportunityId: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(tasksQuerySchema, searchParams);
    if (parsed.error) return parsed.error;
    const { opportunityId, status, page, limit } = parsed.data;

    const where: Record<string, unknown> = {};
    if (opportunityId) where.opportunityId = opportunityId;

    if (status === "pending") {
      where.isCompleted = false;
    } else if (status === "completed") {
      where.isCompleted = true;
    } else if (status === "overdue") {
      where.isCompleted = false;
      where.dueDate = { lt: new Date() };
    }

    const offset = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          opportunity: { select: { id: true, title: true } },
        },
        orderBy: [{ isCompleted: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        skip: offset,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({ tasks, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(createTaskSchema, request);
    if (parsed.error) return parsed.error;
    const { title, description, dueDate, priority, opportunityId } = parsed.data;

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        opportunityId: opportunityId || null,
      },
      include: {
        opportunity: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
