import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseBody } from "@/lib/validations/common";
import { executeTaskCompletionChain } from "@/lib/workflow-engine";
import { createAuditLog, diffAndLog } from "@/lib/audit";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  isCompleted: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseBody(updateTaskSchema, request);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Fetch old state for audit
    const oldTask = await prisma.task.findUnique({
      where: { id },
      select: { title: true, priority: true, dueDate: true, isCompleted: true, opportunityId: true },
    });

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        if (key === "dueDate" && typeof value === "string") {
          updateData[key] = new Date(value);
        } else if (key === "isCompleted" && value === true) {
          updateData.isCompleted = true;
          updateData.completedAt = new Date();
        } else if (key === "isCompleted" && value === false) {
          updateData.isCompleted = false;
          updateData.completedAt = null;
        } else {
          updateData[key] = value;
        }
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        opportunity: { select: { id: true, title: true } },
      },
    });

    // Audit logging
    if (oldTask) {
      if (body.isCompleted === true) {
        await createAuditLog({
          eventType: "COMPLETED",
          entityType: "TASK",
          entityId: id,
          opportunityId: task.opportunityId,
          summary: `Completed task: ${task.title}`,
        });
      } else {
        await diffAndLog(
          oldTask as unknown as Record<string, unknown>,
          updateData,
          {
            entityType: "TASK",
            entityId: id,
            opportunityId: task.opportunityId,
            fieldLabels: {
              title: "title",
              priority: "priority",
              dueDate: "due date",
              isCompleted: "completed",
            },
            ignoreFields: ["completedAt"],
          }
        );
      }
    }

    // If task was just completed and is linked to an opportunity, run follow-up chain
    if (body.isCompleted === true && task.opportunityId) {
      await executeTaskCompletionChain(task.id);
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch before delete for audit
    const taskToDelete = await prisma.task.findUnique({
      where: { id },
      select: { title: true, opportunityId: true },
    });

    await prisma.task.delete({ where: { id } });

    if (taskToDelete) {
      await createAuditLog({
        eventType: "DELETED",
        entityType: "TASK",
        entityId: id,
        opportunityId: taskToDelete.opportunityId,
        summary: `Deleted task: ${taskToDelete.title}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
