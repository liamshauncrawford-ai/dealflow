"use client";

import { useForm } from "react-hook-form";
import { useCreateOperator, useUpdateOperator } from "@/hooks/use-market-intel";
import { OPERATOR_TIERS, OPERATOR_RELATIONSHIP_STATUS } from "@/lib/market-intel-constants";

interface OperatorFormProps {
  initialData?: Record<string, unknown>;
  onSuccess?: () => void;
}

export function OperatorForm({ initialData, onSuccess }: OperatorFormProps) {
  const isEdit = !!initialData?.id;
  const createOperator = useCreateOperator();
  const updateOperator = useUpdateOperator();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: (initialData?.name as string) ?? "",
      parentCompany: (initialData?.parentCompany as string) ?? "",
      hqLocation: (initialData?.hqLocation as string) ?? "",
      hqState: (initialData?.hqState as string) ?? "",
      website: (initialData?.website as string) ?? "",
      tier: (initialData?.tier as string) ?? "",
      cablingOpportunityScore: initialData?.cablingOpportunityScore ?? "",
      estimatedAnnualCablingRevenue: initialData?.estimatedAnnualCablingRevenue ?? "",
      activeConstruction: (initialData?.activeConstruction as boolean) ?? false,
      constructionTimeline: (initialData?.constructionTimeline as string) ?? "",
      phaseCount: initialData?.phaseCount ?? "",
      relationshipStatus: (initialData?.relationshipStatus as string) ?? "",
      primaryContactName: (initialData?.primaryContactName as string) ?? "",
      primaryContactTitle: (initialData?.primaryContactTitle as string) ?? "",
      primaryContactEmail: (initialData?.primaryContactEmail as string) ?? "",
      primaryContactPhone: (initialData?.primaryContactPhone as string) ?? "",
      notes: (initialData?.notes as string) ?? "",
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    // Clean up empty strings and convert numbers
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === "" || value === undefined) continue;
      if (key === "cablingOpportunityScore" || key === "phaseCount") {
        cleaned[key] = Number(value);
      } else if (key === "estimatedAnnualCablingRevenue") {
        cleaned[key] = Number(value);
      } else {
        cleaned[key] = value;
      }
    }

    if (isEdit) {
      updateOperator.mutate(
        { id: initialData!.id as string, data: cleaned },
        { onSuccess }
      );
    } else {
      createOperator.mutate(cleaned, { onSuccess });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Name *">
          <input {...register("name", { required: true })} className="form-input" placeholder="e.g. Vantage Data Centers" />
          {errors.name && <p className="mt-1 text-xs text-red-500">Required</p>}
        </FormField>
        <FormField label="Parent Company">
          <input {...register("parentCompany")} className="form-input" placeholder="e.g. DigitalBridge" />
        </FormField>
        <FormField label="HQ Location">
          <input {...register("hqLocation")} className="form-input" placeholder="e.g. Denver, CO" />
        </FormField>
        <FormField label="HQ State">
          <input {...register("hqState")} className="form-input" placeholder="e.g. CO" />
        </FormField>
        <FormField label="Website">
          <input {...register("website")} className="form-input" placeholder="https://..." />
        </FormField>
        <FormField label="Tier">
          <select {...register("tier")} className="form-input">
            <option value="">Select tier...</option>
            {Object.entries(OPERATOR_TIERS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Cabling Opportunity Score (1-10)">
          <input {...register("cablingOpportunityScore")} type="number" min="1" max="10" className="form-input" />
        </FormField>
        <FormField label="Est. Annual Cabling Revenue ($)">
          <input {...register("estimatedAnnualCablingRevenue")} type="number" className="form-input" />
        </FormField>
        <FormField label="Relationship Status">
          <select {...register("relationshipStatus")} className="form-input">
            <option value="">Select status...</option>
            {Object.entries(OPERATOR_RELATIONSHIP_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Construction Timeline">
          <input {...register("constructionTimeline")} className="form-input" placeholder="e.g. 2025-2027" />
        </FormField>
        <FormField label="Phase Count">
          <input {...register("phaseCount")} type="number" className="form-input" />
        </FormField>
        <FormField label="Active Construction">
          <div className="flex items-center gap-2 h-9">
            <input {...register("activeConstruction")} type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm">Currently constructing</span>
          </div>
        </FormField>
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-3 font-semibold">Primary Contact</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Name">
            <input {...register("primaryContactName")} className="form-input" />
          </FormField>
          <FormField label="Title">
            <input {...register("primaryContactTitle")} className="form-input" />
          </FormField>
          <FormField label="Email">
            <input {...register("primaryContactEmail")} type="email" className="form-input" />
          </FormField>
          <FormField label="Phone">
            <input {...register("primaryContactPhone")} className="form-input" />
          </FormField>
        </div>
      </div>

      <FormField label="Notes">
        <textarea {...register("notes")} className="form-input min-h-[80px]" rows={3} />
      </FormField>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {isSubmitting ? "Saving..." : isEdit ? "Update Operator" : "Create Operator"}
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
