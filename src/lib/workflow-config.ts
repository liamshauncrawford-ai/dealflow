/**
 * Workflow Automation Configuration
 *
 * Centralized, type-safe config for all workflow triggers.
 * Stored in code (not DB) — solo-user CRM, config changes need code review.
 */

import type { PipelineStage } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface StageTransitionConfig {
  /** Task to auto-create when entering this stage (null = no task) */
  task: {
    title: string;
    description: string;
    dueDaysFromNow: number;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  } | null;
  /** Contact fields to update on the primary contact (null = no update) */
  contactUpdate: {
    outreachStatus?: string;
  } | null;
  /** Days from now to set nextFollowUpDate on primary contact (null = don't set) */
  followUpDaysFromNow: number | null;
}

export interface FollowUpChainConfig {
  /** Next task to create when the triggered task is completed (null = no chain) */
  nextTask: {
    title: string;
    dueDaysFromNow: number;
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  } | null;
}

// ─────────────────────────────────────────────
// Stage Trigger Config
// ─────────────────────────────────────────────

export const STAGE_TRIGGER_CONFIG: Record<PipelineStage, StageTransitionConfig> = {
  CONTACTING: {
    task: {
      title: "Send initial outreach",
      description: "Draft and send initial contact message to the broker or seller",
      dueDaysFromNow: 1,
      priority: "HIGH",
    },
    contactUpdate: { outreachStatus: "COLD_OUTREACH_SENT" },
    followUpDaysFromNow: 3,
  },
  REQUESTED_CIM: {
    task: {
      title: "Follow up on CIM request",
      description: "Check if CIM has been received; follow up with broker if not",
      dueDaysFromNow: 3,
      priority: "MEDIUM",
    },
    contactUpdate: { outreachStatus: "IN_DIALOGUE" },
    followUpDaysFromNow: 5,
  },
  SIGNED_NDA: {
    task: {
      title: "Begin due diligence review",
      description: "Review CIM, prepare initial financial analysis and questions list",
      dueDaysFromNow: 2,
      priority: "HIGH",
    },
    contactUpdate: { outreachStatus: "DUE_DILIGENCE" },
    followUpDaysFromNow: 5,
  },
  DUE_DILIGENCE: {
    task: {
      title: "Complete financial analysis",
      description: "Finish financial model, review tax returns, assess key risks",
      dueDaysFromNow: 7,
      priority: "HIGH",
    },
    contactUpdate: null,
    followUpDaysFromNow: 7,
  },
  OFFER_SENT: {
    task: {
      title: "Follow up on offer response",
      description: "Check in with broker/seller on offer status",
      dueDaysFromNow: 5,
      priority: "HIGH",
    },
    contactUpdate: { outreachStatus: "LOI_STAGE" },
    followUpDaysFromNow: 5,
  },
  COUNTER_OFFER_RECEIVED: {
    task: {
      title: "Evaluate counter-offer terms",
      description: "Review counter-offer, model revised terms, prepare response",
      dueDaysFromNow: 3,
      priority: "CRITICAL",
    },
    contactUpdate: null,
    followUpDaysFromNow: 3,
  },
  UNDER_CONTRACT: {
    task: {
      title: "Coordinate closing timeline",
      description: "Align on closing timeline, coordinate with legal and financing",
      dueDaysFromNow: 7,
      priority: "HIGH",
    },
    contactUpdate: null,
    followUpDaysFromNow: 7,
  },
  CLOSED_WON: {
    task: {
      title: "Begin integration planning",
      description: "Start Day 1 integration plan, key employee meetings, systems setup",
      dueDaysFromNow: 3,
      priority: "MEDIUM",
    },
    contactUpdate: { outreachStatus: "CLOSED" },
    followUpDaysFromNow: null,
  },
  CLOSED_LOST: {
    task: null,
    contactUpdate: { outreachStatus: "DEAD" },
    followUpDaysFromNow: null,
  },
  ON_HOLD: {
    task: {
      title: "Re-evaluate deal",
      description: "Review reasons for hold, check if conditions have changed",
      dueDaysFromNow: 14,
      priority: "LOW",
    },
    contactUpdate: null,
    followUpDaysFromNow: 14,
  },
};

// ─────────────────────────────────────────────
// Follow-Up Chain Config
// When a triggered task is completed, create the next follow-up
// ─────────────────────────────────────────────

export const FOLLOW_UP_CHAIN_CONFIG: Record<PipelineStage, FollowUpChainConfig> = {
  CONTACTING: {
    nextTask: { title: "Follow up on initial outreach", dueDaysFromNow: 3, priority: "MEDIUM" },
  },
  REQUESTED_CIM: {
    nextTask: { title: "Follow up on CIM status", dueDaysFromNow: 3, priority: "MEDIUM" },
  },
  SIGNED_NDA: {
    nextTask: null, // DD review is a one-off
  },
  DUE_DILIGENCE: {
    nextTask: { title: "Check in on due diligence progress", dueDaysFromNow: 5, priority: "MEDIUM" },
  },
  OFFER_SENT: {
    nextTask: { title: "Follow up on offer again", dueDaysFromNow: 5, priority: "HIGH" },
  },
  COUNTER_OFFER_RECEIVED: {
    nextTask: null, // One-off evaluation
  },
  UNDER_CONTRACT: {
    nextTask: { title: "Check closing progress", dueDaysFromNow: 7, priority: "MEDIUM" },
  },
  CLOSED_WON: { nextTask: null },
  CLOSED_LOST: { nextTask: null },
  ON_HOLD: {
    nextTask: { title: "Re-evaluate deal again", dueDaysFromNow: 14, priority: "LOW" },
  },
};

// ─────────────────────────────────────────────
// Stale Contact Detection Thresholds
// Days since last interaction before flagging as stale
// ─────────────────────────────────────────────

export const STALE_CONTACT_CONFIG: Record<string, number> = {
  TIER_1_ACTIVE: 14,
  TIER_2_WATCH: 30,
  DEFAULT: 21,
};

// ─────────────────────────────────────────────
// Outreach Status Progression Order
// Used to ensure we only advance, never regress
// ─────────────────────────────────────────────

export const OUTREACH_PROGRESSION: string[] = [
  "NOT_CONTACTED",
  "COLD_OUTREACH_SENT",
  "WARM_INTRO_MADE",
  "IN_DIALOGUE",
  "LOI_STAGE",
  "DUE_DILIGENCE",
  "CLOSED",
  "DEAD",
];
