import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import type { ImportCalculatorContent } from "@/types/siteContent";
import { adminApi } from "../adminApi";

/**
 * Admin → Site Content → Import Cost Estimator. Sets every number behind the public estimator on the
 * Import page: shipping per country, duty, VAT, your fees. It stays hidden from visitors until
 * "Show it on the Import page" is ticked — check the rates against what you really pay first.
 */
export default function ImportCalculatorSettings({ initial, onSaved }: { initial: ImportCalculatorContent; onSaved: () => void }) {
  const [values, setValues] = useState<ImportCalculatorContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const num = (field: keyof ImportCalculatorContent) => (e: { target: { value: string } }) => setValues({ ...values, [field]: Number(e.target.value) });

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/importCalculator", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the estimator.");
      setStatus("error");
    }
  }

  function updateOrigin(index: number, patch: Partial<ImportCalculatorContent["origins"][number]>) {
    setValues({ ...values, origins: values.origins.map((origin, i) => (i === index ? { ...origin, ...patch } : origin)) });
  }

  return (
    <form id="site-content-importCalculator" className="form-card" onSubmit={save} noValidate>
      <h2>Import Cost Estimator</h2>
      <p className="text-muted">A calculator on the Import page where visitors estimate the total cost of importing a vehicle. The starting numbers are placeholders — set them to your real costs before switching it on.</p>
      {status === "success" && <FormStatusBanner status="success" successMessage="Estimator updated." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <label className="form-check" style={{ marginBottom: "var(--space-4)" }}>
        <input type="checkbox" checked={values.enabled} onChange={(e) => setValues({ ...values, enabled: e.target.checked })} />
        <span><strong>Show it on the Import page</strong></span>
      </label>

      <div className="form-grid form-grid--2col">
        <FormField id="ic-heading" label="Heading" value={values.heading} onChange={(e) => setValues({ ...values, heading: e.target.value })} />
        <FormField id="ic-intro" label="Intro line" value={values.intro} onChange={(e) => setValues({ ...values, intro: e.target.value })} />
        <FormField id="ic-duty" label="Import duty (% of vehicle + shipping)" type="number" step="0.1" value={values.dutyPercent} onChange={num("dutyPercent")} />
        <FormField id="ic-vat" label="VAT and other taxes (%)" type="number" step="0.1" value={values.vatPercent} onChange={num("vatPercent")} />
        <FormField id="ic-clearing" label="Clearing & documentation fee (USD)" type="number" value={values.clearingFeeUsd} onChange={num("clearingFeeUsd")} />
        <FormField id="ic-fee" label="Your service fee (% of vehicle price)" type="number" step="0.1" value={values.serviceFeePercent} onChange={num("serviceFeePercent")} />
        <FormField id="ic-delivery" label="Delivery inside Malawi (USD)" type="number" value={values.deliveryUsd} onChange={num("deliveryUsd")} />
        <FormField id="ic-disclaimer" label="Small print under the estimate" as="textarea" wrapperClassName="form-grid__full" value={values.disclaimer} onChange={(e) => setValues({ ...values, disclaimer: e.target.value })} />
      </div>

      <fieldset className="site-content-fieldset">
        <legend>Countries and shipping cost per vehicle (USD)</legend>
        {values.origins.map((origin, index) => (
          <div key={index} className="form-grid form-grid--2col" style={{ alignItems: "end" }}>
            <FormField id={`ic-o-name-${index}`} label="Country" value={origin.name} onChange={(e) => updateOrigin(index, { name: e.target.value })} />
            <FormField id={`ic-o-ship-${index}`} label="Shipping (USD)" type="number" value={origin.shippingUsd} onChange={(e) => updateOrigin(index, { shippingUsd: Number(e.target.value) })} />
            <button type="button" className="btn btn-ghost" onClick={() => setValues({ ...values, origins: values.origins.filter((_, i) => i !== index) })}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setValues({ ...values, origins: [...values.origins, { name: "", shippingUsd: 0 }] })}>Add a country</button>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save estimator"}</button>
      </div>
    </form>
  );
}
