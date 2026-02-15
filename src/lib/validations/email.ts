import { z } from "zod";

// ─────────────────────────────────────────────
// Send Email
// ─────────────────────────────────────────────

export const sendEmailSchema = z.object({
  emailAccountId: z.string().min(1, "emailAccountId is required"),
  to: z.array(z.string().email()).min(1, "At least one recipient is required"),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyHtml: z.string().min(1, "Email body is required"),
  opportunityId: z.string().optional(),
  inReplyToExternalId: z.string().optional(),
  conversationId: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

// ─────────────────────────────────────────────
// Email Templates
// ─────────────────────────────────────────────

const templateCategories = [
  "CIM_REQUEST",
  "NDA_REQUEST",
  "INTRODUCTION",
  "FOLLOW_UP",
  "LOI",
  "GENERAL",
] as const;

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  subject: z.string().min(1, "Subject is required"),
  bodyHtml: z.string().min(1, "Body is required"),
  category: z.enum(templateCategories).default("GENERAL"),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const generateTemplateSchema = z.object({
  category: z.enum(templateCategories),
  context: z.string().optional(),
});
