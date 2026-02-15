/**
 * Maps raw financial statement labels to canonical P&L categories.
 * Supports fuzzy matching for variations in seller-reported financials.
 *
 * Categories: REVENUE, COGS, OPEX, D_AND_A, INTEREST, TAX, OTHER_INCOME, OTHER_EXPENSE
 */

export interface CanonicalMapping {
  category: string;
  subcategory?: string;
  confidence: number;
}

// ─────────────────────────────────────────────
// Label → Category Map
// ─────────────────────────────────────────────

const LABEL_MAP: Record<string, { category: string; subcategory?: string }> = {
  // Revenue
  "revenue": { category: "REVENUE" },
  "gross revenue": { category: "REVENUE" },
  "total revenue": { category: "REVENUE" },
  "net revenue": { category: "REVENUE" },
  "sales": { category: "REVENUE" },
  "total sales": { category: "REVENUE" },
  "net sales": { category: "REVENUE" },
  "service revenue": { category: "REVENUE", subcategory: "SERVICES" },
  "product revenue": { category: "REVENUE", subcategory: "PRODUCTS" },
  "contract revenue": { category: "REVENUE", subcategory: "CONTRACTS" },
  "project revenue": { category: "REVENUE", subcategory: "PROJECTS" },
  "recurring revenue": { category: "REVENUE", subcategory: "RECURRING" },
  "service income": { category: "REVENUE", subcategory: "SERVICES" },
  "installation revenue": { category: "REVENUE", subcategory: "INSTALLATION" },
  "maintenance revenue": { category: "REVENUE", subcategory: "MAINTENANCE" },

  // COGS — general
  "cost of goods sold": { category: "COGS" },
  "cogs": { category: "COGS" },
  "cost of sales": { category: "COGS" },
  "cost of revenue": { category: "COGS" },
  "direct costs": { category: "COGS" },
  "total cost of goods sold": { category: "COGS" },
  "total direct costs": { category: "COGS" },

  // COGS — trades-specific subcategories
  "materials": { category: "COGS", subcategory: "MATERIALS" },
  "materials and supplies": { category: "COGS", subcategory: "MATERIALS" },
  "direct materials": { category: "COGS", subcategory: "MATERIALS" },
  "direct labor": { category: "COGS", subcategory: "LABOR" },
  "labor": { category: "COGS", subcategory: "LABOR" },
  "field labor": { category: "COGS", subcategory: "LABOR" },
  "shop labor": { category: "COGS", subcategory: "LABOR" },
  "subcontractor costs": { category: "COGS", subcategory: "SUBCONTRACTORS" },
  "subcontractors": { category: "COGS", subcategory: "SUBCONTRACTORS" },
  "subs": { category: "COGS", subcategory: "SUBCONTRACTORS" },
  "equipment costs": { category: "COGS", subcategory: "EQUIPMENT" },
  "tools and equipment": { category: "COGS", subcategory: "EQUIPMENT" },
  "permits and licenses": { category: "COGS", subcategory: "PERMITS" },

  // Operating Expenses — general
  "operating expenses": { category: "OPEX" },
  "total operating expenses": { category: "OPEX" },
  "general and administrative": { category: "OPEX", subcategory: "G_AND_A" },
  "g&a": { category: "OPEX", subcategory: "G_AND_A" },
  "selling general and administrative": { category: "OPEX", subcategory: "SGA" },
  "sg&a": { category: "OPEX", subcategory: "SGA" },

  // OpEx — sub-categories
  "rent": { category: "OPEX", subcategory: "RENT" },
  "rent expense": { category: "OPEX", subcategory: "RENT" },
  "lease expense": { category: "OPEX", subcategory: "RENT" },
  "utilities": { category: "OPEX", subcategory: "UTILITIES" },
  "insurance": { category: "OPEX", subcategory: "INSURANCE" },
  "insurance expense": { category: "OPEX", subcategory: "INSURANCE" },
  "payroll": { category: "OPEX", subcategory: "PAYROLL" },
  "salaries and wages": { category: "OPEX", subcategory: "PAYROLL" },
  "salaries": { category: "OPEX", subcategory: "PAYROLL" },
  "wages": { category: "OPEX", subcategory: "PAYROLL" },
  "payroll taxes": { category: "OPEX", subcategory: "PAYROLL_TAXES" },
  "employee benefits": { category: "OPEX", subcategory: "BENEFITS" },
  "health insurance": { category: "OPEX", subcategory: "BENEFITS" },
  "marketing": { category: "OPEX", subcategory: "MARKETING" },
  "advertising": { category: "OPEX", subcategory: "MARKETING" },
  "advertising and marketing": { category: "OPEX", subcategory: "MARKETING" },
  "professional fees": { category: "OPEX", subcategory: "PROFESSIONAL_FEES" },
  "legal and professional": { category: "OPEX", subcategory: "PROFESSIONAL_FEES" },
  "accounting fees": { category: "OPEX", subcategory: "PROFESSIONAL_FEES" },
  "legal fees": { category: "OPEX", subcategory: "PROFESSIONAL_FEES" },
  "vehicle expense": { category: "OPEX", subcategory: "VEHICLES" },
  "auto expense": { category: "OPEX", subcategory: "VEHICLES" },
  "truck expense": { category: "OPEX", subcategory: "VEHICLES" },
  "fuel": { category: "OPEX", subcategory: "VEHICLES" },
  "office expense": { category: "OPEX", subcategory: "OFFICE" },
  "office supplies": { category: "OPEX", subcategory: "OFFICE" },
  "repairs and maintenance": { category: "OPEX", subcategory: "REPAIRS" },
  "maintenance": { category: "OPEX", subcategory: "REPAIRS" },
  "travel": { category: "OPEX", subcategory: "TRAVEL" },
  "travel expense": { category: "OPEX", subcategory: "TRAVEL" },
  "meals and entertainment": { category: "OPEX", subcategory: "MEALS" },
  "meals": { category: "OPEX", subcategory: "MEALS" },
  "telephone": { category: "OPEX", subcategory: "TELECOM" },
  "phone": { category: "OPEX", subcategory: "TELECOM" },
  "internet": { category: "OPEX", subcategory: "TELECOM" },
  "software": { category: "OPEX", subcategory: "SOFTWARE" },
  "software subscriptions": { category: "OPEX", subcategory: "SOFTWARE" },
  "training": { category: "OPEX", subcategory: "TRAINING" },
  "continuing education": { category: "OPEX", subcategory: "TRAINING" },
  "safety": { category: "OPEX", subcategory: "SAFETY" },
  "bad debt": { category: "OPEX", subcategory: "BAD_DEBT" },

  // Owner-specific (important for add-back identification)
  "owner compensation": { category: "OPEX", subcategory: "OWNER_COMP" },
  "officer compensation": { category: "OPEX", subcategory: "OWNER_COMP" },
  "officers compensation": { category: "OPEX", subcategory: "OWNER_COMP" },
  "owner salary": { category: "OPEX", subcategory: "OWNER_COMP" },
  "owner draw": { category: "OPEX", subcategory: "OWNER_COMP" },
  "management fees": { category: "OPEX", subcategory: "MANAGEMENT_FEES" },

  // Depreciation & Amortization
  "depreciation": { category: "D_AND_A", subcategory: "DEPRECIATION" },
  "amortization": { category: "D_AND_A", subcategory: "AMORTIZATION" },
  "depreciation and amortization": { category: "D_AND_A" },
  "depreciation expense": { category: "D_AND_A", subcategory: "DEPRECIATION" },
  "d&a": { category: "D_AND_A" },

  // Interest
  "interest expense": { category: "INTEREST" },
  "interest": { category: "INTEREST" },
  "loan interest": { category: "INTEREST" },

  // Tax
  "income tax": { category: "TAX" },
  "income tax expense": { category: "TAX" },
  "tax expense": { category: "TAX" },
  "provision for income taxes": { category: "TAX" },
  "income taxes": { category: "TAX" },

  // Other
  "other income": { category: "OTHER_INCOME" },
  "interest income": { category: "OTHER_INCOME", subcategory: "INTEREST" },
  "miscellaneous income": { category: "OTHER_INCOME" },
  "other expense": { category: "OTHER_EXPENSE" },
  "other expenses": { category: "OTHER_EXPENSE" },
  "gain on sale": { category: "OTHER_INCOME", subcategory: "GAIN_ON_SALE" },
  "loss on sale": { category: "OTHER_EXPENSE", subcategory: "LOSS_ON_SALE" },
  "gain on disposal": { category: "OTHER_INCOME", subcategory: "GAIN_ON_SALE" },
  "loss on disposal": { category: "OTHER_EXPENSE", subcategory: "LOSS_ON_SALE" },
};

// ─────────────────────────────────────────────
// Fuzzy Matching
// ─────────────────────────────────────────────

function normalize(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps a raw financial label to a canonical category + subcategory.
 * Returns null if no match found.
 */
export function mapLabelToCanonical(rawLabel: string): CanonicalMapping | null {
  const normalized = normalize(rawLabel);
  if (!normalized) return null;

  // 1. Exact match
  if (LABEL_MAP[normalized]) {
    return { ...LABEL_MAP[normalized], confidence: 1.0 };
  }

  // 2. Check if normalized input contains a known key
  let bestMatch: { key: string; mapping: { category: string; subcategory?: string } } | null = null;
  let bestLen = 0;

  for (const [key, mapping] of Object.entries(LABEL_MAP)) {
    if (normalized.includes(key) && key.length > bestLen) {
      bestMatch = { key, mapping };
      bestLen = key.length;
    }
  }

  if (bestMatch && bestLen >= 3) {
    const ratio = bestLen / normalized.length;
    return { ...bestMatch.mapping, confidence: Math.min(0.9, 0.5 + ratio * 0.4) };
  }

  // 3. Check if any known key contains the normalized input
  for (const [key, mapping] of Object.entries(LABEL_MAP)) {
    if (key.includes(normalized) && normalized.length >= 3) {
      const ratio = normalized.length / key.length;
      return { ...mapping, confidence: Math.min(0.8, 0.4 + ratio * 0.4) };
    }
  }

  return null;
}

/**
 * All canonical P&L categories in display order.
 */
export const CANONICAL_CATEGORIES = [
  "REVENUE",
  "COGS",
  "OPEX",
  "D_AND_A",
  "INTEREST",
  "TAX",
  "OTHER_INCOME",
  "OTHER_EXPENSE",
] as const;

/**
 * Human-readable labels for canonical categories.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  REVENUE: "Revenue",
  COGS: "Cost of Goods Sold",
  OPEX: "Operating Expenses",
  D_AND_A: "Depreciation & Amortization",
  INTEREST: "Interest Expense",
  TAX: "Income Tax",
  OTHER_INCOME: "Other Income",
  OTHER_EXPENSE: "Other Expenses",
};

/**
 * Human-readable labels for add-back categories.
 */
export const ADD_BACK_CATEGORY_LABELS: Record<string, string> = {
  OWNER_COMPENSATION: "Owner Compensation",
  PERSONAL_EXPENSES: "Personal Expenses",
  ONE_TIME_COSTS: "One-Time Costs",
  DISCRETIONARY: "Discretionary",
  RELATED_PARTY: "Related Party",
  NON_CASH: "Non-Cash",
  OTHER: "Other",
};

/**
 * Subcategories that commonly indicate add-back candidates.
 */
export const ADD_BACK_INDICATOR_SUBCATEGORIES = [
  "OWNER_COMP",
  "MANAGEMENT_FEES",
  "MEALS",
  "TRAVEL",
  "VEHICLES",
] as const;
