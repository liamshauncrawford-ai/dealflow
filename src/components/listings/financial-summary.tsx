"use client";

import { Calculator } from "lucide-react";
import { cn, formatCurrency, formatMultiple, formatPercent } from "@/lib/utils";
import { INFERENCE_METHODS } from "@/lib/constants";

interface FinancialSummaryProps {
  askingPrice?: number | string | null;
  revenue?: number | string | null;
  ebitda?: number | string | null;
  sde?: number | string | null;
  cashFlow?: number | string | null;
  inferredEbitda?: number | string | null;
  inferredSde?: number | string | null;
  inferenceMethod?: string | null;
  inferenceConfidence?: number | null;
  priceToEbitda?: number | null;
  priceToSde?: number | null;
  priceToRevenue?: number | null;
  compact?: boolean;
  className?: string;
}

function toNumber(val: number | string | null | undefined): number | null {
  if (val == null) return null;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? null : n;
}

function FinancialValue({
  label,
  value,
  inferred,
  inferenceMethod,
  confidence,
  compact,
}: {
  label: string;
  value: number | null;
  inferred?: number | null;
  inferenceMethod?: string | null;
  confidence?: number | null;
  compact?: boolean;
}) {
  const displayValue = value ?? inferred;
  const isInferred = value == null && inferred != null;
  const method = inferenceMethod
    ? INFERENCE_METHODS[inferenceMethod as keyof typeof INFERENCE_METHODS]
    : null;

  if (displayValue == null) {
    return compact ? null : (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">N/A</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <p
          className={cn(
            compact ? "text-sm font-medium" : "text-lg font-semibold",
            isInferred && "border-b border-dashed border-muted-foreground/50"
          )}
          title={
            isInferred && method
              ? `${method.description}. Confidence: ${formatPercent(confidence)}`
              : undefined
          }
        >
          {formatCurrency(displayValue)}
        </p>
        {isInferred && (
          <span title={method?.description || "Estimated value"}>
            <Calculator className="h-3 w-3 text-muted-foreground" />
          </span>
        )}
      </div>
    </div>
  );
}

export function FinancialSummary({
  askingPrice,
  revenue,
  ebitda,
  sde,
  cashFlow,
  inferredEbitda,
  inferredSde,
  inferenceMethod,
  inferenceConfidence,
  priceToEbitda,
  priceToSde,
  priceToRevenue,
  compact = false,
  className,
}: FinancialSummaryProps) {
  const price = toNumber(askingPrice);
  const rev = toNumber(revenue);
  const eb = toNumber(ebitda);
  const sd = toNumber(sde);
  const cf = toNumber(cashFlow);
  const infEb = toNumber(inferredEbitda);
  const infSde = toNumber(inferredSde);

  if (compact) {
    return (
      <div className={cn("flex gap-4", className)}>
        <FinancialValue label="Price" value={price} compact />
        <FinancialValue label="Revenue" value={rev} compact />
        <FinancialValue
          label="EBITDA"
          value={eb}
          inferred={infEb}
          inferenceMethod={inferenceMethod}
          confidence={inferenceConfidence}
          compact
        />
        <FinancialValue
          label="SDE"
          value={sd}
          inferred={infSde}
          inferenceMethod={inferenceMethod}
          confidence={inferenceConfidence}
          compact
        />
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4", className)}>
      <div className="rounded-lg border bg-card p-3">
        <FinancialValue label="Asking Price" value={price} />
      </div>
      <div className="rounded-lg border bg-card p-3">
        <FinancialValue label="Revenue" value={rev} />
      </div>
      <div className="rounded-lg border bg-card p-3">
        <FinancialValue
          label="EBITDA"
          value={eb}
          inferred={infEb}
          inferenceMethod={inferenceMethod}
          confidence={inferenceConfidence}
        />
      </div>
      <div className="rounded-lg border bg-card p-3">
        <FinancialValue
          label="SDE"
          value={sd}
          inferred={infSde}
          inferenceMethod={inferenceMethod}
          confidence={inferenceConfidence}
        />
      </div>
      <div className="rounded-lg border bg-card p-3">
        <FinancialValue label="Cash Flow" value={cf} />
      </div>
      {priceToEbitda && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Price/EBITDA</p>
          <p className="text-lg font-semibold">{formatMultiple(priceToEbitda)}</p>
        </div>
      )}
      {priceToSde && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Price/SDE</p>
          <p className="text-lg font-semibold">{formatMultiple(priceToSde)}</p>
        </div>
      )}
      {priceToRevenue && (
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Price/Revenue</p>
          <p className="text-lg font-semibold">{formatMultiple(priceToRevenue)}</p>
        </div>
      )}
    </div>
  );
}
