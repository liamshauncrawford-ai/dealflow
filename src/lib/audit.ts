import { prisma } from "@/lib/db";
import type { AuditEventType, AuditEntityType, AuditActorType } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface CreateAuditLogParams {
  eventType: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  opportunityId?: string | null;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  summary: string;
  actorType?: AuditActorType;
}

interface DiffAndLogOptions {
  eventType?: AuditEventType;
  entityType: AuditEntityType;
  entityId: string;
  opportunityId?: string | null;
  actorType?: AuditActorType;
  /** Map of field keys to human-readable labels */
  fieldLabels?: Record<string, string>;
  /** Fields to ignore when comparing */
  ignoreFields?: string[];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  const str = String(value);
  // Format enum-style values: "COUNTER_OFFER_RECEIVED" → "Counter Offer Received"
  if (/^[A-Z_]+$/.test(str)) {
    return str
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
  }
  return str;
}

function buildFieldChangeSummary(
  label: string,
  oldVal: unknown,
  newVal: unknown
): string {
  const oldDisplay = formatDisplayValue(oldVal);
  const newDisplay = formatDisplayValue(newVal);

  if (oldVal === null || oldVal === undefined) {
    return `Set ${label} to ${newDisplay}`;
  }
  if (newVal === null || newVal === undefined) {
    return `Cleared ${label} (was ${oldDisplay})`;
  }
  return `Changed ${label} from ${oldDisplay} to ${newDisplay}`;
}

// ─────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────

/**
 * Creates a single audit log entry.
 * Wrapped in try/catch so audit failures never break business operations.
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: params.eventType,
        entityType: params.entityType,
        entityId: params.entityId,
        opportunityId: params.opportunityId ?? undefined,
        fieldName: params.fieldName ?? undefined,
        oldValue: stringifyValue(params.oldValue),
        newValue: stringifyValue(params.newValue),
        summary: params.summary,
        actorType: params.actorType ?? "USER",
      },
    });
  } catch (error) {
    console.error("[Audit] Failed to create audit log:", error);
  }
}

/**
 * Compares two objects field-by-field and creates an audit entry for each changed field.
 * Returns the number of changes logged.
 */
export async function diffAndLog(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  options: DiffAndLogOptions
): Promise<number> {
  const {
    eventType = "UPDATED",
    entityType,
    entityId,
    opportunityId,
    actorType,
    fieldLabels = {},
    ignoreFields = [],
  } = options;

  let changeCount = 0;

  for (const key of Object.keys(newData)) {
    if (ignoreFields.includes(key)) continue;

    const oldVal = oldData[key];
    const newVal = newData[key];

    // Skip if the values are the same
    if (stringifyValue(oldVal) === stringifyValue(newVal)) continue;

    const label = fieldLabels[key] || key;
    const summary = buildFieldChangeSummary(label, oldVal, newVal);

    await createAuditLog({
      eventType,
      entityType,
      entityId,
      opportunityId,
      fieldName: key,
      oldValue: oldVal,
      newValue: newVal,
      summary,
      actorType,
    });

    changeCount++;
  }

  return changeCount;
}
