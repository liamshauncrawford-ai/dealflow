import { z } from "zod";

export const auditEntityTypes = [
  "OPPORTUNITY",
  "CONTACT",
  "NOTE",
  "DOCUMENT",
  "TASK",
  "EMAIL",
] as const;

export const auditEventTypes = [
  "CREATED",
  "UPDATED",
  "DELETED",
  "STAGE_CHANGED",
  "LINKED",
  "UNLINKED",
  "SENT",
  "UPLOADED",
  "COMPLETED",
] as const;

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  opportunityId: z.string().optional(),
  entityType: z.enum(auditEntityTypes).optional(),
  eventType: z.enum(auditEventTypes).optional(),
});

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
