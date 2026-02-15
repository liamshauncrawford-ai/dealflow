/**
 * Financial Quality Checks
 *
 * Runs 10 checks against financial periods to flag potential issues:
 * margin benchmarks, YoY volatility, add-back ratios, missing data, etc.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type CheckSeverity = "error" | "warning" | "info";

export interface QualityCheck {
  id: string;
  severity: CheckSeverity;
  title: string;
  message: string;
}

/**
 * Run all quality checks against a set of financial periods.
 */
export function runQualityChecks(periods: any[]): QualityCheck[] {
  if (!periods || periods.length === 0) return [];

  const checks: QualityCheck[] = [];
  const sorted = [...periods].sort((a, b) => b.year - a.year);
  const latest = sorted[0];

  const revenue = Number(latest.totalRevenue ?? 0);
  const ebitda = Number(latest.ebitda ?? 0);
  const adjustedEbitda = Number(latest.adjustedEbitda ?? 0);
  const sde = Number(latest.sde ?? 0);
  const grossMargin = Number(latest.grossMargin ?? 0);
  const ebitdaMargin = Number(latest.ebitdaMargin ?? 0);
  const addBackTotal = Number(latest.totalAddBacks ?? 0);

  // 1. Negative EBITDA
  if (ebitda < 0) {
    checks.push({
      id: "negative-ebitda",
      severity: "error",
      title: "Negative EBITDA",
      message: `EBITDA is negative ($${Math.round(ebitda).toLocaleString()}). This business is not profitable before adjustments.`,
    });
  }

  // 2. Below thesis minimum (target: $600K-$2M EBITDA)
  if (adjustedEbitda > 0 && adjustedEbitda < 600_000) {
    checks.push({
      id: "below-thesis-minimum",
      severity: "warning",
      title: "Below Thesis Minimum",
      message: `Adj. EBITDA of $${Math.round(adjustedEbitda).toLocaleString()} is below the $600K thesis floor.`,
    });
  }

  // 3. Add-back ratio > 30% of revenue = warning, > 50% = error
  if (revenue > 0 && addBackTotal > 0) {
    const addBackRatio = addBackTotal / revenue;
    if (addBackRatio > 0.5) {
      checks.push({
        id: "high-addback-ratio",
        severity: "error",
        title: "Very High Add-Back Ratio",
        message: `Add-backs are ${(addBackRatio * 100).toFixed(1)}% of revenue — extremely high and may not survive buyer due diligence.`,
      });
    } else if (addBackRatio > 0.3) {
      checks.push({
        id: "elevated-addback-ratio",
        severity: "warning",
        title: "Elevated Add-Back Ratio",
        message: `Add-backs are ${(addBackRatio * 100).toFixed(1)}% of revenue. Buyers may scrutinize these adjustments.`,
      });
    }
  }

  // 4. Gross margin check (trades/contractor: 25-45% typical)
  if (revenue > 0 && grossMargin > 0) {
    if (grossMargin < 0.15) {
      checks.push({
        id: "low-gross-margin",
        severity: "warning",
        title: "Low Gross Margin",
        message: `Gross margin of ${(grossMargin * 100).toFixed(1)}% is below typical range for trades businesses (25-45%).`,
      });
    } else if (grossMargin > 0.65) {
      checks.push({
        id: "high-gross-margin",
        severity: "info",
        title: "High Gross Margin",
        message: `Gross margin of ${(grossMargin * 100).toFixed(1)}% is unusually high — verify COGS is complete.`,
      });
    }
  }

  // 5. EBITDA margin benchmarks
  if (revenue > 0 && ebitdaMargin > 0) {
    if (ebitdaMargin < 0.08) {
      checks.push({
        id: "low-ebitda-margin",
        severity: "warning",
        title: "Low EBITDA Margin",
        message: `EBITDA margin of ${(ebitdaMargin * 100).toFixed(1)}% is thin. Limited room for debt service.`,
      });
    } else if (ebitdaMargin > 0.35) {
      checks.push({
        id: "high-ebitda-margin",
        severity: "info",
        title: "High EBITDA Margin",
        message: `EBITDA margin of ${(ebitdaMargin * 100).toFixed(1)}% — very strong. Verify operating expenses are complete.`,
      });
    }
  }

  // 6. Owner compensation check
  if (sde > 0 && adjustedEbitda > 0) {
    const ownerCompImputed = sde - adjustedEbitda;
    if (revenue > 0 && ownerCompImputed / revenue > 0.25) {
      checks.push({
        id: "high-owner-comp",
        severity: "warning",
        title: "High Owner Compensation",
        message: `Imputed owner comp is ${((ownerCompImputed / revenue) * 100).toFixed(1)}% of revenue. May indicate owner-dependent business.`,
      });
    }
  }

  // 7. YoY revenue volatility (> 20% swing)
  if (sorted.length >= 2) {
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = Number(sorted[i].totalRevenue ?? 0);
      const prev = Number(sorted[i + 1].totalRevenue ?? 0);
      if (prev > 0 && curr > 0) {
        const change = Math.abs((curr - prev) / prev);
        if (change > 0.2) {
          checks.push({
            id: `yoy-volatility-${sorted[i].year}`,
            severity: "warning",
            title: `Revenue Volatility (${sorted[i].year})`,
            message: `${sorted[i].year} revenue changed ${change > 0 ? "+" : ""}${(((curr - prev) / prev) * 100).toFixed(1)}% YoY. High volatility increases risk.`,
          });
        }
      }
    }
  }

  // 8. Missing line items check
  if (latest.lineItems) {
    const categories = new Set(latest.lineItems.map((li: any) => li.category));
    const expected = ["REVENUE", "COGS", "OPEX"];
    const missing = expected.filter((cat) => !categories.has(cat));
    if (missing.length > 0) {
      checks.push({
        id: "missing-line-items",
        severity: "info",
        title: "Incomplete P&L",
        message: `Missing categories: ${missing.join(", ")}. Add these for accurate computation.`,
      });
    }
  }

  // 9. Math consistency (revenue - COGS should ≈ gross profit)
  if (latest.totalRevenue && latest.totalCogs && latest.grossProfit) {
    const expectedGP = Number(latest.totalRevenue) - Number(latest.totalCogs);
    const actualGP = Number(latest.grossProfit);
    if (Math.abs(expectedGP - actualGP) > 1) {
      checks.push({
        id: "math-inconsistency",
        severity: "error",
        title: "Math Inconsistency",
        message: `Gross Profit doesn't match Revenue - COGS (expected $${Math.round(expectedGP).toLocaleString()}, got $${Math.round(actualGP).toLocaleString()}).`,
      });
    }
  }

  // 10. Single year data
  if (sorted.length === 1) {
    checks.push({
      id: "single-period",
      severity: "info",
      title: "Limited Data",
      message: "Only one financial period. Add more years to see trends and compute growth rates.",
    });
  }

  // Sort by severity: error first, then warning, then info
  const order = { error: 0, warning: 1, info: 2 };
  checks.sort((a, b) => order[a.severity] - order[b.severity]);

  return checks;
}
