/**
 * Workflow Automation Engine
 *
 * Three subsystems:
 * 1. Stage-change triggers — auto-create tasks + update contacts
 * 2. Task completion chaining — completing a task creates the next follow-up
 * 3. Stale/overdue detection — on-demand checks for forgotten contacts
 */

import { prisma } from "@/lib/db";
import type { PipelineStage } from "@prisma/client";
import {
  STAGE_TRIGGER_CONFIG,
  FOLLOW_UP_CHAIN_CONFIG,
  STALE_CONTACT_CONFIG,
  OUTREACH_PROGRESSION,
} from "@/lib/workflow-config";
import { createAuditLog } from "@/lib/audit";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // 9 AM
  return d;
}

function isOutreachAdvance(current: string | null, proposed: string): boolean {
  const currentIdx = OUTREACH_PROGRESSION.indexOf(current ?? "NOT_CONTACTED");
  const proposedIdx = OUTREACH_PROGRESSION.indexOf(proposed);
  return proposedIdx > currentIdx;
}

// ─────────────────────────────────────────────
// 1. Stage-Change Triggers
// ─────────────────────────────────────────────

export async function executeStageChangeTriggers(
  opportunityId: string,
  fromStage: PipelineStage,
  toStage: PipelineStage,
): Promise<void> {
  const config = STAGE_TRIGGER_CONFIG[toStage];
  if (!config) return;

  try {
    // Create auto-task (with dedup check)
    if (config.task) {
      const existing = await prisma.task.findFirst({
        where: {
          opportunityId,
          triggerStage: toStage,
          isCompleted: false,
        },
      });

      if (!existing) {
        const newTask = await prisma.task.create({
          data: {
            opportunityId,
            title: config.task.title,
            description: config.task.description,
            dueDate: daysFromNow(config.task.dueDaysFromNow),
            priority: config.task.priority,
            source: "STAGE_TRIGGER",
            triggerStage: toStage,
          },
        });
        console.log(
          `[Workflow] Created task "${config.task.title}" for opp ${opportunityId} (stage → ${toStage})`,
        );
        await createAuditLog({
          eventType: "CREATED",
          entityType: "TASK",
          entityId: newTask.id,
          opportunityId,
          summary: `Auto-created task: ${config.task.title}`,
          actorType: "WORKFLOW",
        });
      }
    }

    // Update primary contact
    const primaryContact = await prisma.contact.findFirst({
      where: { opportunityId, isPrimary: true },
    });

    if (primaryContact) {
      const contactUpdates: Record<string, unknown> = {};

      // Advance outreach status (never regress)
      if (
        config.contactUpdate?.outreachStatus &&
        isOutreachAdvance(
          primaryContact.outreachStatus,
          config.contactUpdate.outreachStatus,
        )
      ) {
        contactUpdates.outreachStatus = config.contactUpdate.outreachStatus;
      }

      // Set follow-up date
      if (config.followUpDaysFromNow !== null) {
        contactUpdates.nextFollowUpDate = daysFromNow(config.followUpDaysFromNow);
      }

      if (Object.keys(contactUpdates).length > 0) {
        await prisma.contact.update({
          where: { id: primaryContact.id },
          data: contactUpdates,
        });
        console.log(
          `[Workflow] Updated contact "${primaryContact.name}" — ${JSON.stringify(contactUpdates)}`,
        );
        await createAuditLog({
          eventType: "UPDATED",
          entityType: "CONTACT",
          entityId: primaryContact.id,
          opportunityId,
          summary: `Auto-updated contact ${primaryContact.name} outreach status`,
          actorType: "WORKFLOW",
        });
      }
    }
  } catch (error) {
    // Log but don't throw — stage change itself should still succeed
    console.error("[Workflow] Stage trigger error:", error);
  }
}

// ─────────────────────────────────────────────
// 2. Task Completion Chaining
// ─────────────────────────────────────────────

export async function executeTaskCompletionChain(taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        opportunity: { select: { id: true, stage: true } },
      },
    });

    if (!task || !task.triggerStage || !task.opportunity) return;

    // Skip if the deal has moved past this task's trigger stage
    if (task.triggerStage !== task.opportunity.stage) {
      console.log(
        `[Workflow] Skipping chain — task stage ${task.triggerStage} ≠ current ${task.opportunity.stage}`,
      );
      return;
    }

    const chainConfig =
      FOLLOW_UP_CHAIN_CONFIG[task.opportunity.stage as PipelineStage];
    if (!chainConfig?.nextTask) return;

    // Dedup: check if a follow-up chain task already exists
    const existing = await prisma.task.findFirst({
      where: {
        opportunityId: task.opportunity.id,
        title: chainConfig.nextTask.title,
        isCompleted: false,
      },
    });

    if (!existing) {
      const chainedTask = await prisma.task.create({
        data: {
          opportunityId: task.opportunity.id,
          title: chainConfig.nextTask.title,
          dueDate: daysFromNow(chainConfig.nextTask.dueDaysFromNow),
          priority: chainConfig.nextTask.priority,
          source: "FOLLOW_UP_CHAIN",
          triggerStage: task.opportunity.stage,
        },
      });
      console.log(
        `[Workflow] Chained task "${chainConfig.nextTask.title}" for opp ${task.opportunity.id}`,
      );
      await createAuditLog({
        eventType: "CREATED",
        entityType: "TASK",
        entityId: chainedTask.id,
        opportunityId: task.opportunity.id,
        summary: `Auto-created task: ${chainConfig.nextTask.title}`,
        actorType: "WORKFLOW",
      });
    }

    // Update primary contact follow-up date
    const primaryContact = await prisma.contact.findFirst({
      where: { opportunityId: task.opportunity.id, isPrimary: true },
    });

    if (primaryContact) {
      await prisma.contact.update({
        where: { id: primaryContact.id },
        data: {
          nextFollowUpDate: daysFromNow(chainConfig.nextTask.dueDaysFromNow),
          lastInteractionDate: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("[Workflow] Task chain error:", error);
  }
}

// ─────────────────────────────────────────────
// 3. Stale & Overdue Detection (On-Demand)
// ─────────────────────────────────────────────

let lastStaleCheck = 0;
const STALE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function checkStaleAndOverdue(): Promise<void> {
  const now = Date.now();
  if (now - lastStaleCheck < STALE_CHECK_INTERVAL_MS) return;
  lastStaleCheck = now;

  try {
    await detectOverdueFollowUps();
    await detectStaleContacts();
  } catch (error) {
    console.error("[Workflow] Stale/overdue check error:", error);
  }
}

async function detectOverdueFollowUps(): Promise<void> {
  const overdueContacts = await prisma.contact.findMany({
    where: {
      isPrimary: true,
      nextFollowUpDate: { lt: new Date() },
      opportunity: {
        stage: {
          notIn: ["CLOSED_WON", "CLOSED_LOST"],
        },
      },
    },
    include: {
      opportunity: { select: { id: true, title: true } },
    },
  });

  for (const contact of overdueContacts) {
    if (!contact.opportunity) continue;

    // Dedup: check for existing overdue task
    const existing = await prisma.task.findFirst({
      where: {
        opportunityId: contact.opportunity.id,
        source: "OVERDUE_DETECTION",
        isCompleted: false,
      },
    });

    if (!existing) {
      await prisma.task.create({
        data: {
          opportunityId: contact.opportunity.id,
          title: `Overdue: Follow up with ${contact.name}`,
          description: `Follow-up was due ${contact.nextFollowUpDate?.toLocaleDateString()}. Contact has not been reached.`,
          dueDate: new Date(), // Due now
          priority: "HIGH",
          source: "OVERDUE_DETECTION",
        },
      });
      console.log(
        `[Workflow] Created overdue task for "${contact.name}" on "${contact.opportunity.title}"`,
      );
    }
  }
}

async function detectStaleContacts(): Promise<void> {
  const activeOpps = await prisma.opportunity.findMany({
    where: {
      stage: { notIn: ["CLOSED_WON", "CLOSED_LOST", "ON_HOLD"] },
    },
    include: {
      contacts: {
        where: { isPrimary: true },
        take: 1,
      },
      listing: {
        select: { tier: true },
      },
    },
  });

  const now = new Date();

  for (const opp of activeOpps) {
    const contact = opp.contacts[0];
    if (!contact) continue;

    // Determine threshold based on tier
    const tier = opp.listing?.tier ?? "DEFAULT";
    const thresholdDays =
      STALE_CONTACT_CONFIG[tier] ?? STALE_CONTACT_CONFIG.DEFAULT;
    const thresholdDate = new Date(
      now.getTime() - thresholdDays * 24 * 60 * 60 * 1000,
    );

    const lastActivity = contact.lastInteractionDate ?? contact.createdAt;
    if (lastActivity > thresholdDate) continue; // Not stale

    // Dedup: check for existing stale detection task
    const existing = await prisma.task.findFirst({
      where: {
        opportunityId: opp.id,
        source: "STALE_DETECTION",
        isCompleted: false,
      },
    });

    if (!existing) {
      const daysSince = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );
      await prisma.task.create({
        data: {
          opportunityId: opp.id,
          title: `Check in with ${contact.name}`,
          description: `No interaction in ${daysSince} days. ${tier !== "DEFAULT" ? `Tier threshold: ${thresholdDays} days.` : ""}`,
          dueDate: new Date(),
          priority: "MEDIUM",
          source: "STALE_DETECTION",
        },
      });
      console.log(
        `[Workflow] Created stale contact task for "${contact.name}" on "${opp.title}" (${daysSince}d idle)`,
      );
    }
  }
}
