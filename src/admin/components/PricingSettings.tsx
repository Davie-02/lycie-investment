import { useCallback, useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";

interface Settings {
  mode: "auto" | "manual";
  manualRate: number | null;
  marginPercent: number;
  roundMwkTo: number;
}

interface Overview {
  settings: Settings;
  effective: { rate: number | null; source: "live" | "manual" | "last-known" | "none"; updatedAt: string | null };
  live: { rate: number; provider: string; at: string } | null;
}

const SOURCE_LABEL: Record<Overview["effective"]["source"], string> = {
  live: "live exchange rate",
  manual: "your manual rate",
  "last-known": "last known live rate (the rate provider isn't answering)",
  none: "no rate yet",
};

/**
 * Admin → Site Content → Currency & Prices.
 * Vehicle and hire prices are entered in US dollars; the site adds the kwacha equivalent using the
 * rate managed here. Auto mode follows a live exchange rate (checked every 30 minutes); manual mode
 * pins a rate you choose; the margin lets you add a cushion so kwacha amounts reflect real-world
 * buying rates. Everything here goes live on visitors' open pages within moments.
 */
export default function PricingSettings() {
  const { currentUser } = useAdminAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [values, setValues] = useState<Settings | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "refreshing" | "converting" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);

  const load = useCallback(() => {
    adminApi
      .get<Overview>("/pricing/admin")
      .then((data) => {
        setOverview(data);
        setValues((current) => current ?? data.settings);
      })
      .catch((err) => setMessage(err instanceof ApiError ? err.message : "Couldn't load the currency settings."));
  }, []);

  useEffect(load, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!values) return;
    setStatus("saving");
    setMessage(null);
    try {
      await adminApi.patch("/pricing/settings", {
        mode: values.mode,
        manualRate: values.mode === "manual" ? Number(values.manualRate) : (values.manualRate ?? undefined),
        marginPercent: Number(values.marginPercent),
        roundMwkTo: Number(values.roundMwkTo),
      });
      setStatus("saved");
      setOverview(await adminApi.get<Overview>("/pricing/admin"));
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiError ? err.message : "Couldn't save the settings.");
    }
  }

  async function refresh() {
    setStatus("refreshing");
    setMessage(null);
    try {
      setOverview(await adminApi.post<Overview>("/pricing/refresh", {}));
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiError ? err.message : "Couldn't refresh the rate.");
    }
  }

  async function convert() {
    setStatus("converting");
    setMessage(null);
    try {
      const result = await adminApi.post<{ vehicles: number; hireVehicles: number; rate: number }>("/pricing/convert-listings", {});
      setConfirmConvert(false);
      setStatus("saved");
      setMessage(`Converted ${result.vehicles} vehicle(s) and ${result.hireVehicles} hire vehicle(s) to US dollars at ${result.rate.toLocaleString("en-US")} MWK per $1.`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof ApiError ? err.message : "Couldn't convert the listings.");
    }
  }

  if (!values) return <form id="site-content-pricing" className="form-card"><h2>Currency &amp; Prices</h2><p className="text-muted">{message ?? "Loading…"}</p></form>;

  const rate = overview?.effective.rate;
  return (
    <form id="site-content-pricing" className="form-card" onSubmit={save} noValidate>
      <h2>Currency &amp; Prices</h2>
      <p className="text-muted">
        Prices are entered and shown in <strong>US dollars</strong>, with the equivalent in Malawi kwacha beside them.
      </p>
      <p>
        Rate in use: <strong>{rate ? `MWK ${rate.toLocaleString("en-US")} per $1` : "not available yet"}</strong>{" "}
        <span className="text-muted">({overview ? SOURCE_LABEL[overview.effective.source] : "…"})</span>
        {overview?.live && (
          <span className="text-muted">
            {" "}· live rate MWK {overview.live.rate.toLocaleString("en-US")} from {overview.live.provider}, fetched {new Date(overview.live.at).toLocaleString()}
          </span>
        )}
      </p>

      {status === "saved" && <FormStatusBanner status="success" successMessage={message ?? "Currency settings saved."} errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={message} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="pricing-mode"
          label="How to get the rate"
          as="select"
          value={values.mode}
          onChange={(e) => setValues({ ...values, mode: e.target.value as Settings["mode"] })}
        >
          <option value="auto">Automatic — follow the live exchange rate</option>
          <option value="manual">Manual — always use the rate I type</option>
        </FormField>
        <FormField
          id="pricing-manual"
          label="Manual rate (MWK per $1)"
          type="number"
          value={values.manualRate ?? ""}
          onChange={(e) => setValues({ ...values, manualRate: e.target.value === "" ? null : Number(e.target.value) })}
          disabled={values.mode !== "manual"}
        />
        <FormField
          id="pricing-margin"
          label="Margin on the live rate (%)"
          type="number"
          step="0.1"
          value={values.marginPercent}
          onChange={(e) => setValues({ ...values, marginPercent: Number(e.target.value) })}
          disabled={values.mode !== "auto"}
          footer={<p className="form-field__hint">Adds a cushion when the everyday market rate is higher than the published one. 5 means 5% more kwacha per dollar.</p>}
        />
        <FormField
          id="pricing-round"
          label="Show kwacha to the nearest"
          as="select"
          value={String(values.roundMwkTo)}
          onChange={(e) => setValues({ ...values, roundMwkTo: Number(e.target.value) })}
        >
          {[1, 10, 100, 500, 1000, 5000, 10000].map((step) => (
            <option key={step} value={step}>{step.toLocaleString("en-US")}</option>
          ))}
        </FormField>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save currency settings"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={refresh} disabled={status === "refreshing"}>
          {status === "refreshing" ? "Checking…" : "Refresh live rate now"}
        </button>
      </div>

      {currentUser?.role === "OWNER" && (
        <div className="site-content-fieldset" style={{ marginTop: "var(--space-5)" }}>
          <h3>Older listings entered in kwacha</h3>
          <p className="text-muted">
            Listings created before the switch are still stored in kwacha (the site already shows them in dollars). Convert them once so
            you can manage every price in dollars. Prices are rounded to tidy amounts and you can adjust any of them afterwards.
          </p>
          {confirmConvert ? (
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={convert} disabled={status === "converting"}>
                {status === "converting" ? "Converting…" : "Yes, convert them now"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmConvert(false)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmConvert(true)}>Convert kwacha listings to USD…</button>
          )}
        </div>
      )}
    </form>
  );
}
