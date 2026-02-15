"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useCreateFinancialPeriod } from "@/hooks/use-financials";
import { CANONICAL_CATEGORIES, CATEGORY_LABELS, ADD_BACK_CATEGORY_LABELS } from "@/lib/financial/canonical-labels";

interface FinancialPeriodFormProps {
  opportunityId: string;
  onClose: () => void;
}

interface LineItemDraft {
  id: string;
  category: string;
  rawLabel: string;
  amount: string;
}

interface AddBackDraft {
  id: string;
  category: string;
  description: string;
  amount: string;
}

const PERIOD_TYPES = [
  { value: "ANNUAL", label: "Annual" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "LTM", label: "LTM (Last 12 Months)" },
  { value: "YTD", label: "YTD (Year to Date)" },
  { value: "PROJECTED", label: "Projected" },
];

const DEFAULT_LINE_ITEMS: Omit<LineItemDraft, "id">[] = [
  { category: "REVENUE", rawLabel: "Total Revenue", amount: "" },
  { category: "COGS", rawLabel: "Cost of Goods Sold", amount: "" },
  { category: "OPEX", rawLabel: "Operating Expenses", amount: "" },
  { category: "D_AND_A", rawLabel: "Depreciation & Amortization", amount: "" },
  { category: "INTEREST", rawLabel: "Interest Expense", amount: "" },
  { category: "TAX", rawLabel: "Tax Expense", amount: "" },
];

let nextId = 1;
function makeId() {
  return `draft-${nextId++}`;
}

export function FinancialPeriodForm({ opportunityId, onClose }: FinancialPeriodFormProps) {
  const createPeriod = useCreateFinancialPeriod(opportunityId);

  const [periodType, setPeriodType] = useState("ANNUAL");
  const [year, setYear] = useState(new Date().getFullYear() - 1);
  const [quarter, setQuarter] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    DEFAULT_LINE_ITEMS.map((item) => ({ ...item, id: makeId() }))
  );
  const [addBacks, setAddBacks] = useState<AddBackDraft[]>([]);

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: makeId(), category: "OPEX", rawLabel: "", amount: "" },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function addAddBack() {
    setAddBacks((prev) => [
      ...prev,
      { id: makeId(), category: "OWNER_COMPENSATION", description: "", amount: "" },
    ]);
  }

  function removeAddBack(id: string) {
    setAddBacks((prev) => prev.filter((ab) => ab.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validLineItems = lineItems
      .filter((li) => li.rawLabel && li.amount)
      .map((li, idx) => ({
        category: li.category,
        rawLabel: li.rawLabel,
        amount: parseFloat(li.amount),
        displayOrder: idx,
      }));

    const validAddBacks = addBacks
      .filter((ab) => ab.description && ab.amount)
      .map((ab) => ({
        category: ab.category,
        description: ab.description,
        amount: parseFloat(ab.amount),
      }));

    await createPeriod.mutateAsync({
      periodType,
      year,
      quarter: periodType === "QUARTERLY" ? quarter : null,
      notes: notes || null,
      dataSource: "MANUAL",
      lineItems: validLineItems.length > 0 ? validLineItems : undefined,
      addBacks: validAddBacks.length > 0 ? validAddBacks : undefined,
    });

    onClose();
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Add Financial Period</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Period Metadata */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Period Type</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {PERIOD_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              min={1990}
              max={2100}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          {periodType === "QUARTERLY" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Quarter</label>
              <select
                value={quarter ?? ""}
                onChange={(e) => setQuarter(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select...</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">P&L Line Items</h4>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add Row
            </button>
          </div>
          <div className="space-y-2">
            {lineItems.map((li) => (
              <div key={li.id} className="flex items-center gap-2">
                <select
                  value={li.category}
                  onChange={(e) =>
                    setLineItems((prev) =>
                      prev.map((item) =>
                        item.id === li.id ? { ...item, category: e.target.value } : item
                      )
                    )
                  }
                  className="w-32 rounded border bg-background px-2 py-1 text-xs"
                >
                  {CANONICAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={li.rawLabel}
                  onChange={(e) =>
                    setLineItems((prev) =>
                      prev.map((item) =>
                        item.id === li.id ? { ...item, rawLabel: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Label"
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  value={li.amount}
                  onChange={(e) =>
                    setLineItems((prev) =>
                      prev.map((item) =>
                        item.id === li.id ? { ...item, amount: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Amount"
                  className="w-32 rounded border bg-background px-2 py-1 text-right text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeLineItem(li.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add-Backs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">Add-Backs</h4>
            <button
              type="button"
              onClick={addAddBack}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" /> Add Add-Back
            </button>
          </div>
          {addBacks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No add-backs. You can add them after creating the period.</p>
          ) : (
            <div className="space-y-2">
              {addBacks.map((ab) => (
                <div key={ab.id} className="flex items-center gap-2">
                  <select
                    value={ab.category}
                    onChange={(e) =>
                      setAddBacks((prev) =>
                        prev.map((item) =>
                          item.id === ab.id ? { ...item, category: e.target.value } : item
                        )
                      )
                    }
                    className="w-40 rounded border bg-background px-2 py-1 text-xs"
                  >
                    {Object.entries(ADD_BACK_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={ab.description}
                    onChange={(e) =>
                      setAddBacks((prev) =>
                        prev.map((item) =>
                          item.id === ab.id ? { ...item, description: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Description"
                    className="flex-1 rounded border bg-background px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={ab.amount}
                    onChange={(e) =>
                      setAddBacks((prev) =>
                        prev.map((item) =>
                          item.id === ab.id ? { ...item, amount: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Amount"
                    className="w-32 rounded border bg-background px-2 py-1 text-right text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeAddBack(ab.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes about this financial period..."
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createPeriod.isPending}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {createPeriod.isPending ? "Creating..." : "Create Period"}
          </button>
        </div>
      </form>
    </div>
  );
}
