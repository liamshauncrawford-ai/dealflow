"use client";

import { useForm } from "react-hook-form";
import { useCreateCablingOpportunity, useUpdateCablingOpportunity, useOperators, useGCs } from "@/hooks/use-market-intel";
import { CABLING_STATUSES, CABLING_SCOPES } from "@/lib/market-intel-constants";

interface CablingFormProps {
  initialData?: Record<string, unknown>;
  onSuccess?: () => void;
}

function toDateInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

export function CablingForm({ initialData, onSuccess }: CablingFormProps) {
  const isEdit = !!initialData?.id;
  const createOpp = useCreateCablingOpportunity();
  const updateOpp = useUpdateCablingOpportunity();

  // Fetch operators and GCs for select dropdowns
  const { data: operatorsData } = useOperators({ pageSize: "100" });
  const { data: gcsData } = useGCs({ pageSize: "100" });
  const operators = operatorsData?.operators ?? [];
  const gcs = gcsData?.gcs ?? [];

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: (initialData?.name as string) ?? "",
      description: (initialData?.description as string) ?? "",
      operatorId: (initialData?.operatorId as string) ?? "",
      gcId: (initialData?.gcId as string) ?? "",
      facilityAddress: (initialData?.facilityAddress as string) ?? "",
      facilitySizeMW: initialData?.facilitySizeMW ?? "",
      estimatedValue: initialData?.estimatedValue ?? "",
      bidSubmittedValue: initialData?.bidSubmittedValue ?? "",
      awardedValue: initialData?.awardedValue ?? "",
      status: (initialData?.status as string) ?? "IDENTIFIED",
      rfqDate: toDateInputValue(initialData?.rfqDate as string),
      bidDueDate: toDateInputValue(initialData?.bidDueDate as string),
      constructionStart: toDateInputValue(initialData?.constructionStart as string),
      constructionEnd: toDateInputValue(initialData?.constructionEnd as string),
      lossReason: (initialData?.lossReason as string) ?? "",
      competitorWhoWon: (initialData?.competitorWhoWon as string) ?? "",
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    const numberFields = ["facilitySizeMW", "estimatedValue", "bidSubmittedValue", "awardedValue"];
    for (const [key, value] of Object.entries(data)) {
      if (value === "" || value === undefined) continue;
      if (numberFields.includes(key)) {
        cleaned[key] = Number(value);
      } else {
        cleaned[key] = value;
      }
    }

    if (isEdit) {
      updateOpp.mutate(
        { id: initialData!.id as string, data: cleaned },
        { onSuccess }
      );
    } else {
      createOpp.mutate(cleaned, { onSuccess });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Name *">
          <input {...register("name", { required: true })} className="form-input" placeholder="e.g. Vantage V42 Backbone Fiber" />
          {errors.name && <p className="mt-1 text-xs text-red-500">Required</p>}
        </FormField>
        <FormField label="Status">
          <select {...register("status")} className="form-input">
            {Object.entries(CABLING_STATUSES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Operator">
          <select {...register("operatorId")} className="form-input">
            <option value="">Select operator...</option>
            {operators.map((op: Record<string, unknown>) => (
              <option key={op.id as string} value={op.id as string}>{op.name as string}</option>
            ))}
          </select>
        </FormField>
        <FormField label="General Contractor">
          <select {...register("gcId")} className="form-input">
            <option value="">Select GC...</option>
            {gcs.map((gc: Record<string, unknown>) => (
              <option key={gc.id as string} value={gc.id as string}>{gc.name as string}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Facility Address">
          <input {...register("facilityAddress")} className="form-input" />
        </FormField>
        <FormField label="Facility Size (MW)">
          <input {...register("facilitySizeMW")} type="number" step="0.1" className="form-input" />
        </FormField>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-3 font-semibold">Financials</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormField label="Estimated Value ($)">
            <input {...register("estimatedValue")} type="number" className="form-input" />
          </FormField>
          <FormField label="Bid Submitted ($)">
            <input {...register("bidSubmittedValue")} type="number" className="form-input" />
          </FormField>
          <FormField label="Awarded Value ($)">
            <input {...register("awardedValue")} type="number" className="form-input" />
          </FormField>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-3 font-semibold">Timeline</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FormField label="RFQ Date">
            <input {...register("rfqDate")} type="date" className="form-input" />
          </FormField>
          <FormField label="Bid Due Date">
            <input {...register("bidDueDate")} type="date" className="form-input" />
          </FormField>
          <FormField label="Construction Start">
            <input {...register("constructionStart")} type="date" className="form-input" />
          </FormField>
          <FormField label="Construction End">
            <input {...register("constructionEnd")} type="date" className="form-input" />
          </FormField>
        </div>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-3 font-semibold">Loss Details (if applicable)</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Loss Reason">
            <input {...register("lossReason")} className="form-input" />
          </FormField>
          <FormField label="Competitor Who Won">
            <input {...register("competitorWhoWon")} className="form-input" />
          </FormField>
        </div>
      </div>

      <FormField label="Description">
        <textarea {...register("description")} className="form-input min-h-[80px]" rows={3} />
      </FormField>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {isSubmitting ? "Saving..." : isEdit ? "Update Opportunity" : "Create Opportunity"}
        </button>
      </div>

      <style jsx>{`
        .form-input {
          display: block;
          width: 100%;
          height: 36px;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .form-input:focus {
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.3);
        }
        textarea.form-input {
          height: auto;
          padding: 0.5rem 0.75rem;
        }
      `}</style>
    </form>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
