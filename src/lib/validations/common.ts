import { z } from "zod";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────
// Reusable Schemas
// ─────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns { data } on success or { error: NextResponse } on failure.
 */
export async function parseBody<T extends z.ZodType>(
  schema: T,
  request: Request,
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Validation failed", details: z.flattenError(result.error) },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}

/**
 * Parse and validate URL search params against a Zod schema.
 * Converts URLSearchParams to a plain object first.
 */
export function parseSearchParams<T extends z.ZodType>(
  schema: T,
  searchParams: URLSearchParams,
): { data: z.infer<T>; error?: never } | { data?: never; error: NextResponse } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: "Invalid query parameters", details: z.flattenError(result.error) },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}
