/**
 * Specialized audit prompt templates for each area of the DealFlow codebase.
 * Used by the autonomous audit script to send targeted reviews to Claude API.
 */

export const SYSTEM_CONTEXT = `You are a senior full-stack engineer auditing DealFlow — an M&A deal sourcing CRM
for acquiring data center and B2B commercial electrical contracting companies.

Tech stack: Next.js 16.1.6 (App Router), React 19, Prisma 5.22, PostgreSQL, TailwindCSS, shadcn/ui, Recharts, React Query.

Acquisition thesis:
- Target EBITDA: $600K-$2M
- Purchase multiples: 3.0x-5.0x with quality adjustments
- Exit multiples: 7-10x
- Key factors: recurring revenue %, customer concentration, key-person risk, DC experience
- SDE and EBITDA both tracked (SDE_TO_EBITDA_RATIO = 1.15)

Key patterns:
- All API mutations validated with Zod schemas
- React Query hooks in src/hooks/ with consistent invalidation patterns
- Audit logging via logAudit() on significant mutations
- Error boundaries around all opportunity detail sections
- Shared valuation waterfall in src/lib/valuation.ts (never duplicate)
- Thesis config via loadThesisConfig() server-side, useThesisSettings() client-side`;

export interface AuditPrompt {
  area: string;
  label: string;
  prompt: string;
  filePatterns: string[];
}

export const AUDIT_PROMPTS: AuditPrompt[] = [
  {
    area: "api",
    label: "API Routes",
    filePatterns: ["src/app/api/**/*.ts"],
    prompt: `Review these Next.js API route handlers for:

1. **Zod Validation**: Every POST/PATCH/PUT must validate request body with Zod. Flag any that parse JSON without validation.
2. **Error Handling**: Must have try/catch with appropriate HTTP status codes. No unhandled promise rejections.
3. **Prisma Query Efficiency**: Flag N+1 queries (queries inside loops), missing \`select\` on large models, unnecessary \`include\` nesting.
4. **Audit Logging**: Significant mutations (create, update, delete) should call logAudit(). Flag any that don't.
5. **Input Sanitization**: Check for SQL injection via raw queries, XSS in returned HTML, path traversal in file operations.
6. **Response Consistency**: Should return NextResponse.json() with consistent shape. Flag mixed response formats.
7. **Missing Auth**: All routes should have some form of auth check (even if simple). Flag completely open routes.

For each finding, specify the file, the issue, severity (info/warning/critical), and a concrete fix.`,
  },
  {
    area: "components",
    label: "React Components",
    filePatterns: ["src/components/**/*.tsx"],
    prompt: `Review these React components for:

1. **Type Safety**: Flag \`any\` types, missing prop interfaces, unsafe type assertions.
2. **Performance**: Missing React.memo on expensive renders, inline object/array creation in JSX props, missing useMemo/useCallback where needed.
3. **Accessibility**: Missing aria labels on interactive elements, missing keyboard navigation, poor contrast.
4. **Loading/Error States**: Components that fetch data should handle loading and error states gracefully.
5. **Consistent Patterns**: Check against shadcn/ui component usage, TailwindCSS class ordering, consistent spacing.
6. **Memory Leaks**: Missing cleanup in useEffect, subscriptions not unsubscribed, event listeners not removed.
7. **Financial Display**: Any currency/number formatting should use formatCurrency(), formatPercent(), etc. from @/lib/utils.

For each finding, specify the file, the issue, severity (info/warning/critical), and a concrete fix.`,
  },
  {
    area: "hooks",
    label: "React Query Hooks",
    filePatterns: ["src/hooks/**/*.ts"],
    prompt: `Review these React Query hooks for:

1. **Query Key Consistency**: Keys should be namespaced and consistent. Flag duplicate or conflicting keys.
2. **Invalidation Completeness**: Mutations should invalidate all related queries. E.g., updating an opportunity should invalidate ["pipeline"], ["opportunity", id], and ["stats"].
3. **Error Handling**: Mutations should have onError with toast notification. Flag silent failures.
4. **Stale Data**: Check refetch intervals, staleTime settings. Dashboard stats should auto-refresh.
5. **Optimistic Updates**: Where appropriate (like stage changes), suggest optimistic updates for better UX.
6. **Type Safety**: Return types should be properly typed, not \`any\`. Query functions should have explicit return types.

For each finding, specify the file, the issue, severity (info/warning/critical), and a concrete fix.`,
  },
  {
    area: "financial",
    label: "Financial Logic",
    filePatterns: [
      "src/lib/valuation.ts",
      "src/lib/financial/**/*.ts",
      "src/lib/scoring/**/*.ts",
      "src/lib/thesis-defaults.ts",
      "src/lib/thesis-loader.ts",
    ],
    prompt: `Review these financial calculation modules for:

1. **Calculation Accuracy**: Verify all formulas (multiples, margins, ratios). Check for off-by-one errors in percentage calculations.
2. **Null/Zero Handling**: All financial functions must handle null, undefined, 0, and negative values gracefully. No division by zero.
3. **Decimal Precision**: Prisma Decimal types must be properly converted to numbers. Check for floating point issues.
4. **Waterfall Consistency**: The canonical valuation waterfall (dealValue → offerPrice → actualEbitda × mult → listing ebitda × mult → askingPrice) must be used everywhere, never duplicated.
5. **Thesis Alignment**: Check that default multiples (3-5x base, 7-10x exit), SDE_TO_EBITDA_RATIO (1.15), and minimum thresholds match the documented thesis.
6. **Edge Cases**: What happens with negative EBITDA? Zero revenue? Missing listing data? Verify all edge cases.
7. **Industry Multiple Staleness**: Cached multiples should have TTL checks. Flag any usage without cache validation.

For each finding, specify the file, the issue, severity (info/warning/critical), and a concrete fix.`,
  },
  {
    area: "schema",
    label: "Prisma Schema",
    filePatterns: ["prisma/schema.prisma"],
    prompt: `Review this Prisma schema for:

1. **Index Coverage**: Frequently queried fields should have indexes. Check foreign keys, enum fields used in WHERE clauses, date fields used in ORDER BY.
2. **Cascade Behavior**: Verify onDelete behavior for all relations. Orphaned records should be impossible.
3. **Field Types**: Decimal for money (not Float), appropriate String lengths, correct enum usage.
4. **Missing Fields**: Based on the thesis (data center M&A), are there fields that would be valuable but are missing?
5. **Relation Integrity**: Check for circular dependencies, missing back-references, ambiguous relations.
6. **Migration Safety**: Flag any changes that would require data migration (renaming fields, changing types, removing required fields).
7. **Default Values**: Check that defaults make sense (e.g., targetMultipleLow=3.0, targetMultipleHigh=5.0).

For each finding, specify the issue, severity (info/warning/critical), and a concrete fix.`,
  },
  {
    area: "email",
    label: "Email System",
    filePatterns: [
      "src/lib/email/**/*.ts",
      "src/app/api/email/**/*.ts",
    ],
    prompt: `Review the email system (Gmail + Outlook integration) for:

1. **Token Security**: OAuth tokens must be encrypted at rest. Check for plaintext tokens in logs or responses.
2. **Rate Limiting**: Gmail/Microsoft APIs have rate limits. Check for proper backoff and retry logic.
3. **Error Recovery**: Sync failures should not corrupt local state. Check for transaction usage.
4. **Email Parsing**: Listing email parser should handle malformed HTML, missing fields, and encoding issues.
5. **Send Safety**: Email send should validate recipients, prevent accidental mass sends, and log all sends.
6. **Attachment Handling**: Check file size limits, MIME type validation, and secure storage.

For each finding, specify the file, the issue, severity (info/warning/critical), and a concrete fix.`,
  },
];

export interface AuditFinding {
  file: string;
  line?: string;
  severity: "info" | "warning" | "critical";
  message: string;
  suggestedFix?: string;
}

export interface AuditAreaResult {
  area: string;
  label: string;
  summary: string;
  findings: AuditFinding[];
  praise: string[];
}

export interface AuditReport {
  timestamp: string;
  totalFiles: number;
  areas: AuditAreaResult[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}
