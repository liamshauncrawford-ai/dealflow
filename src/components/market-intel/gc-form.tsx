"use client";

import { useForm } from "react-hook-form";
import { useCreateGC, useUpdateGC } from "@/hooks/use-market-intel";
import { GC_PRIORITIES, GC_DC_EXPERIENCE, SUB_QUALIFICATION_STATUS, GC_RELATIONSHIP_STATUS } from "@/lib/market-intel-constants";

interface GCFormProps {
  initialData?: Record<string, unknown>;
  onSuccess?: () => void;
}

export function GCForm({ initialData, onSuccess }: GCFormProps) {
  const isEdit = !!initialData?.id;
  const createGC = useCreateGC();
  const updateGC = useUpdateGC();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: (initialData?.name as string) ?? "",
      hqLocation: (initialData?.hqLocation as string) ?? "",
      website: (initialData?.website as string) ?? "",
      coloradoOffice: (initialData?.coloradoOffice as boolean) ?? false,
      coloradoOfficeAddress: (initialData?.coloradoOfficeAddress as string) ?? "",
      dcExperienceLevel: (initialData?.dcExperienceLevel as string) ?? "",
      approvedSubList: (initialData?.approvedSubList as boolean) ?? false,
      subQualificationStatus: (initialData?.subQualificationStatus as string) ?? "",
      prequalificationRequirements: (initialData?.prequalificationRequirements as string) ?? "",
      relationshipStatus: (initialData?.relationshipStatus as string) ?? "",
      priority: (initialData?.priority as string) ?? "",
      estimatedAnnualOpportunity: initialData?.estimatedAnnualOpportunity ?? "",
      primaryContactName: (initialData?.primaryContactName as string) ?? "",
      primaryContactTitle: (initialData?.primaryContactTitle as string) ?? "",
      primaryContactEmail: (initialData?.primaryContactEmail as string) ?? "",
      primaryContactPhone: (initialData?.primaryContactPhone as string) ?? "",
      notes: (initialData?.notes as string) ?? "",
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === "" || value === undefined) continue;
      if (key === "estimatedAnnualOpportunity") {
        cleaned[key] = Number(value);
      } else {
        cleaned[key] = value;
      }
    }

    if (isEdit) {
      updateGC.mutate(
        { id: initialData!.id as string, data: cleaned },
        { onSuccess }
      );
    } else {
      createGC.mutate(cleaned, { onSuccess });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Name *">
          <input {...register("name", { required: true })} className="form-input" placeholder="e.g. JE Dunn Construction" />
          {errors.name && <p className="mt-1 text-xs text-red-500">Required</p>}
        </FormField>
        <FormField label="HQ Location">
          <input {...register("hqLocation")} className="form-input" placeholder="e.g. Kansas City, MO" />
        </FormField>
        <FormField label="Website">
          <input {...register("website")} className="form-input" placeholder="https://..." />
        </FormField>
        <FormField label="Priority">
          <select {...register("priority")} className="form-input">
            <option value="">Select priority...</option>
            {Object.entries(GC_PRIORITIES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="DC Experience Level">
          <select {...register("dcExperienceLevel")} className="form-input">
            <option value="">Select level...</option>
            {Object.entries(GC_DC_EXPERIENCE).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Relationship Status">
          <select {...register("relationshipStatus")} className="form-input">
            <option value="">Select status...</option>
            {Object.entries(GC_RELATIONSHIP_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Sub-Qualification Status">
          <select {...register("subQualificationStatus")} className="form-input">
            <option value="">Select status...</option>
            {Object.entries(SUB_QUALIFICATION_STATUS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Est. Annual Opportunity ($)">
          <input {...register("estimatedAnnualOpportunity")} type="number" className="form-input" />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Colorado Office">
          <div className="flex items-center gap-2 h-9">
            <input {...register("coloradoOffice")} type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm">Has Colorado office</span>
          </div>
        </FormField>
        <FormField label="Colorado Office Address">
          <input {...register("coloradoOfficeAddress")} className="form-input" />
        </FormField>
        <FormField label="Approved Sub List">
          <div className="flex items-center gap-2 h-9">
            <input {...register("approvedSubList")} type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm">On approved sub list</span>
          </div>
        </FormField>
        <FormField label="Prequalification Requirements">
          <input {...register("prequalificationRequirements")} className="form-input" />
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
          {isSubmitting ? "Saving..." : isEdit ? "Update GC" : "Create GC"}
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
