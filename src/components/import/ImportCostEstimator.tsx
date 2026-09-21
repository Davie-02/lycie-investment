import { useState } from "react";
import Price from "@/components/common/Price";
import FormField from "@/components/forms/FormField";
import { useSiteContent } from "@/context/SiteContentContext";
import { estimateImportCost } from "@/utils/importCost";

/**
 * "Estimate your import cost" on the Import page: a visitor enters a vehicle's price and where it
 * would come from and sees the likely total landed in Malawi, broken down. Every rate is edited by an
 * admin (Site Content → Import Cost Estimator); the widget stays hidden until they switch it on.
 */
export default function ImportCostEstimator() {
  const { content } = useSiteContent();
  const config = content.importCalculator;
  const [price, setPrice] = useState("");
  const [origin, setOrigin] = useState(config.origins[0]?.name ?? "");

  if (!config.enabled || config.origins.length === 0) return null;
  const estimate = estimateImportCost(Number(price), origin, config);

  const rows: Array<[string, number]> | null = estimate
    ? [
        ["Vehicle price", estimate.vehiclePrice],
        ["Shipping", estimate.shipping],
        ["Import duty", estimate.duty],
        ["VAT and taxes", estimate.vat],
        ["Clearing & documentation", estimate.clearing],
        ["Our service fee", estimate.serviceFee],
        ["Delivery in Malawi", estimate.delivery],
      ]
    : null;

  return (
    <section className="section container" id="estimate">
      <div className="section-heading">
        <span className="eyebrow">Plan your budget</span>
        <h2>{config.heading}</h2>
        <p>{config.intro}</p>
      </div>
      <div className="form-card" style={{ maxWidth: 640 }}>
        <div className="form-grid form-grid--2col">
          <FormField id="est-price" label="Vehicle price abroad (USD)" type="number" inputMode="decimal" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 8000" />
          <FormField id="est-origin" label="Shipping from" as="select" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {config.origins.map((item) => (<option key={item.name} value={item.name}>{item.name}</option>))}
          </FormField>
        </div>

        {rows && estimate ? (
          <div aria-live="polite" style={{ marginTop: "var(--space-5)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "0.5rem 0" }} className="text-muted">{label}</td>
                    <td style={{ padding: "0.5rem 0", textAlign: "right" }} className="mono">{`$${value.toLocaleString("en-US")}`}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "0.75rem 0", fontWeight: 700 }}>Estimated total</td>
                  <td style={{ padding: "0.75rem 0", textAlign: "right", fontWeight: 700 }} className="mono"><Price amount={estimate.total} currency="USD" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted" style={{ marginTop: "var(--space-4)" }}>Enter a price to see the estimate.</p>
        )}
        <p className="text-muted" style={{ fontSize: "var(--fs-xs)", marginTop: "var(--space-4)" }}>{config.disclaimer}</p>
      </div>
    </section>
  );
}
