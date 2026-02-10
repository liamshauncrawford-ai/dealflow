"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useCreateListing } from "@/hooks/use-listings";

export default function AddListingPage() {
  const router = useRouter();
  const createListing = useCreateListing();
  const [formData, setFormData] = useState({
    title: "",
    businessName: "",
    description: "",
    askingPrice: "",
    revenue: "",
    ebitda: "",
    sde: "",
    cashFlow: "",
    inventory: "",
    ffe: "",
    realEstate: "",
    city: "",
    state: "CO",
    county: "",
    zipCode: "",
    metroArea: "Denver Metro",
    industry: "",
    category: "",
    brokerName: "",
    brokerCompany: "",
    brokerPhone: "",
    brokerEmail: "",
    sellerFinancing: "",
    employees: "",
    established: "",
    reasonForSale: "",
    facilities: "",
    sourceUrl: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) return;

    const data: Record<string, unknown> = {
      title: formData.title.trim(),
    };

    // Add non-empty string fields
    const stringFields = [
      "businessName", "description", "city", "state", "county",
      "zipCode", "metroArea", "industry", "category",
      "brokerName", "brokerCompany", "brokerPhone", "brokerEmail",
      "reasonForSale", "facilities", "sourceUrl",
    ];
    for (const field of stringFields) {
      const val = formData[field as keyof typeof formData];
      if (val && val.trim()) data[field] = val.trim();
    }

    // Add numeric fields
    const numericFields = [
      "askingPrice", "revenue", "ebitda", "sde", "cashFlow",
      "inventory", "ffe", "realEstate", "employees", "established",
    ];
    for (const field of numericFields) {
      const val = formData[field as keyof typeof formData];
      if (val && !isNaN(Number(val))) data[field] = Number(val);
    }

    // Boolean fields
    if (formData.sellerFinancing === "true") data.sellerFinancing = true;
    if (formData.sellerFinancing === "false") data.sellerFinancing = false;

    try {
      await createListing.mutateAsync(data);
      router.push("/listings");
    } catch (err) {
      console.error("Failed to create listing:", err);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/listings"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Add Listing Manually</h1>
        <p className="text-sm text-muted-foreground">
          Add a business listing that you found outside of the scraped platforms
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Section title="Basic Information">
          <FormField
            label="Listing Title *"
            value={formData.title}
            onChange={(v) => updateField("title", v)}
            placeholder="e.g., Profitable HVAC Company in Denver"
            required
          />
          <FormField
            label="Business Name"
            value={formData.businessName}
            onChange={(v) => updateField("businessName", v)}
            placeholder="Actual business name (if known)"
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Industry"
              value={formData.industry}
              onChange={(v) => updateField("industry", v)}
              placeholder="e.g., Construction, HVAC"
            />
            <FormField
              label="Category"
              value={formData.category}
              onChange={(v) => updateField("category", v)}
              placeholder="e.g., Residential, Commercial"
            />
          </div>
          <FormField
            label="Description"
            value={formData.description}
            onChange={(v) => updateField("description", v)}
            placeholder="Business description..."
            multiline
          />
        </Section>

        {/* Financials */}
        <Section title="Financials">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Asking Price ($)"
              value={formData.askingPrice}
              onChange={(v) => updateField("askingPrice", v)}
              placeholder="e.g., 2500000"
              type="number"
            />
            <FormField
              label="Revenue ($)"
              value={formData.revenue}
              onChange={(v) => updateField("revenue", v)}
              placeholder="Annual revenue"
              type="number"
            />
            <FormField
              label="EBITDA ($)"
              value={formData.ebitda}
              onChange={(v) => updateField("ebitda", v)}
              placeholder="Annual EBITDA"
              type="number"
            />
            <FormField
              label="SDE ($)"
              value={formData.sde}
              onChange={(v) => updateField("sde", v)}
              placeholder="Seller's discretionary earnings"
              type="number"
            />
            <FormField
              label="Cash Flow ($)"
              value={formData.cashFlow}
              onChange={(v) => updateField("cashFlow", v)}
              placeholder="Annual cash flow"
              type="number"
            />
            <FormField
              label="Inventory ($)"
              value={formData.inventory}
              onChange={(v) => updateField("inventory", v)}
              placeholder="Inventory value"
              type="number"
            />
            <FormField
              label="FF&E ($)"
              value={formData.ffe}
              onChange={(v) => updateField("ffe", v)}
              placeholder="Furniture, fixtures & equipment"
              type="number"
            />
            <FormField
              label="Real Estate ($)"
              value={formData.realEstate}
              onChange={(v) => updateField("realEstate", v)}
              placeholder="Real estate value"
              type="number"
            />
          </div>
        </Section>

        {/* Location */}
        <Section title="Location">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="City"
              value={formData.city}
              onChange={(v) => updateField("city", v)}
              placeholder="e.g., Denver"
            />
            <FormField
              label="State"
              value={formData.state}
              onChange={(v) => updateField("state", v)}
              placeholder="e.g., CO"
            />
            <FormField
              label="Metro Area"
              value={formData.metroArea}
              onChange={(v) => updateField("metroArea", v)}
              placeholder="e.g., Denver Metro"
            />
            <FormField
              label="ZIP Code"
              value={formData.zipCode}
              onChange={(v) => updateField("zipCode", v)}
              placeholder="e.g., 80202"
            />
          </div>
        </Section>

        {/* Business Details */}
        <Section title="Business Details">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Employees"
              value={formData.employees}
              onChange={(v) => updateField("employees", v)}
              placeholder="Number of employees"
              type="number"
            />
            <FormField
              label="Year Established"
              value={formData.established}
              onChange={(v) => updateField("established", v)}
              placeholder="e.g., 2005"
              type="number"
            />
            <div>
              <label className="mb-1 block text-sm font-medium">Seller Financing</label>
              <select
                value={formData.sellerFinancing}
                onChange={(e) => updateField("sellerFinancing", e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Unknown</option>
                <option value="true">Available</option>
                <option value="false">Not available</option>
              </select>
            </div>
          </div>
          <FormField
            label="Reason for Sale"
            value={formData.reasonForSale}
            onChange={(v) => updateField("reasonForSale", v)}
            placeholder="Why is the business being sold?"
            multiline
          />
          <FormField
            label="Facilities"
            value={formData.facilities}
            onChange={(v) => updateField("facilities", v)}
            placeholder="Describe the facilities..."
            multiline
          />
        </Section>

        {/* Broker */}
        <Section title="Broker / Contact">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Broker Name"
              value={formData.brokerName}
              onChange={(v) => updateField("brokerName", v)}
              placeholder="Full name"
            />
            <FormField
              label="Broker Company"
              value={formData.brokerCompany}
              onChange={(v) => updateField("brokerCompany", v)}
              placeholder="Brokerage firm"
            />
            <FormField
              label="Phone"
              value={formData.brokerPhone}
              onChange={(v) => updateField("brokerPhone", v)}
              placeholder="Phone number"
            />
            <FormField
              label="Email"
              value={formData.brokerEmail}
              onChange={(v) => updateField("brokerEmail", v)}
              placeholder="Email address"
              type="email"
            />
          </div>
        </Section>

        {/* Source URL */}
        <Section title="Source">
          <FormField
            label="Source URL (optional)"
            value={formData.sourceUrl}
            onChange={(v) => updateField("sourceUrl", v)}
            placeholder="https://... (link to the original listing)"
            type="url"
          />
        </Section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 border-t pt-4">
          <Link
            href="/listings"
            className="rounded-md border px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!formData.title.trim() || createListing.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {createListing.isPending ? "Saving..." : "Save Listing"}
          </button>
        </div>

        {createListing.isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to save listing. Please try again.
          </div>
        )}
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-4 text-lg font-medium">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  );
}
