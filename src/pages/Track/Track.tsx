/**
 * Public shipment tracking (/track?code=LYC-XXXXXX): anyone with the tracking
 * code sees the vehicle's progress and photos — never the customer's details.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Seo from "@/components/common/Seo";
import ShipmentTimeline, { type ShipmentUpdateView } from "@/components/common/ShipmentTimeline";
import { apiGet } from "@/services/http";
import { useT } from "@/i18n/LanguageContext";
import "@/components/forms/FormField.css";

interface Tracking {
  trackingCode: string;
  title: string;
  kind: string;
  stage: string | null;
  eta: string | null;
  updates: ShipmentUpdateView[];
}

export default function Track() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const code = params.get("code") ?? "";
  const [input, setInput] = useState(code);
  const [result, setResult] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    apiGet<Tracking>(`/track/${encodeURIComponent(code)}`)
      .then(setResult)
      .catch((err: Error) => {
        setResult(null);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [code]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim()) setParams({ code: input.trim().toUpperCase() });
  }

  return (
    <>
      <Seo title={t("track.title")} description="Follow your imported vehicle from purchase to delivery." />
      <section className="service-hero">
        <div className="container">
          <h1>{t("track.title")}</h1>
          <p>{t("track.intro")}</p>
        </div>
      </section>
      <section className="section container" style={{ maxWidth: 820 }}>
        <form className="form-card" onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="form-field" style={{ flex: "1 1 220px", margin: 0 }}>
            <label htmlFor="track-code">{t("track.code")}</label>
            <input id="track-code" className="form-field__input" placeholder="LYC-7K2M9Q" value={input} onChange={(e) => setInput(e.target.value)} autoCapitalize="characters" />
          </div>
          <button className="btn btn-primary" type="submit">
            {t("track.button")}
          </button>
        </form>
        {loading && <p className="text-muted">…</p>}
        {error && <p className="form-status form-status--error" role="alert">{error}</p>}
        {result && (
          <div className="form-card" style={{ marginTop: "1.5rem" }}>
            <h2 style={{ marginTop: 0 }}>{result.title}</h2>
            <p className="text-muted mono">{result.trackingCode}</p>
            <ShipmentTimeline stage={result.stage} eta={result.eta} updates={result.updates} />
          </div>
        )}
      </section>
    </>
  );
}
