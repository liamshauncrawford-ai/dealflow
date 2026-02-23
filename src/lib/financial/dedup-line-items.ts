/**
 * Post-extraction safety net: detects and removes parent/child
 * duplicate line items that would cause double-counting.
 *
 * QuickBooks (and similar) P&L exports often include both:
 *   - "Payroll Expenses (Total): $619,798" (parent summary row)
 *   - Individual child items: Salary, Regular Pay, etc.
 *
 * If both are stored, `recomputePeriodSummary()` sums everything,
 * inflating the totals. This function removes the parent rows
 * when matching children exist.
 */

import type { ExtractedLineItem } from "@/lib/ai/financial-extractor";

/**
 * Remove parent/total line items whose amounts are approximately
 * accounted for by other items in the same category.
 *
 * @param items - Raw extracted line items (pre-storage)
 * @returns Deduplicated items with parent/total rows removed
 */
export function deduplicateLineItems(items: ExtractedLineItem[]): {
  deduplicated: ExtractedLineItem[];
  removed: ExtractedLineItem[];
} {
  const removed: ExtractedLineItem[] = [];

  // Group items by category
  const byCategory = new Map<string, ExtractedLineItem[]>();
  for (const item of items) {
    const group = byCategory.get(item.category) ?? [];
    group.push(item);
    byCategory.set(item.category, group);
  }

  const keep: ExtractedLineItem[] = [];

  for (const [, group] of byCategory) {
    if (group.length <= 1) {
      // Single item in category — always keep
      keep.push(...group);
      continue;
    }

    // Identify potential "total" rows by label patterns
    const totalPattern = /\(total\)|total\s*$|^\s*total\s/i;

    for (const item of group) {
      const isTotal = totalPattern.test(item.rawLabel);

      if (!isTotal) {
        keep.push(item);
        continue;
      }

      // This looks like a total row. Check if the non-total items
      // in this category sum to approximately the same amount.
      const siblings = group.filter(
        (other) => other !== item && !totalPattern.test(other.rawLabel),
      );

      if (siblings.length === 0) {
        // No children found — this total IS the leaf data, keep it
        keep.push(item);
        continue;
      }

      const siblingSum = siblings.reduce(
        (sum, s) => sum + Math.abs(s.amount),
        0,
      );
      const totalAmt = Math.abs(item.amount);

      // If siblings sum to within 10% of the total, this is a parent row
      // that would cause double-counting — remove it
      const tolerance = Math.max(totalAmt * 0.1, 1); // 10% or $1 minimum
      if (totalAmt > 0 && Math.abs(siblingSum - totalAmt) <= tolerance) {
        removed.push(item);
      } else {
        // Siblings don't match — could be a legitimately separate item
        // whose label happens to contain "total". Keep it.
        keep.push(item);
      }
    }
  }

  return { deduplicated: keep, removed };
}
