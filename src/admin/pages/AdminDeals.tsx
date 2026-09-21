/**
 * Admin → Deals & Market (Owner/Manager).
 *  1. Deals: search the internet for current vehicle deals, review each one, edit the wording, then
 *     publish it to the site or dismiss it. Where a deal was found and how to get it are shown ONLY
 *     here; visitors see just the title, description, price and end date.
 *  2. What customers want: ranked demand from the company's own numbers.
 *  3. Market briefing: an AI-researched summary of what is selling and how to beat other companies.
 * Talks to /api/deal-admin and /api/market.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import Price from "@/components/common/Price";
import { ApiError } from "@/services/http";
import type { AdminDeal, DealStatus } from "@/types/deal";
import { adminApi } from "../adminApi";
import "../components/AdminLayout.css";

type Tab = "deals" | "demand" | "briefing";

export default function AdminDeals() {
  const [tab, setTab] = useState<Tab>("deals");
  const tabs: Array<[Tab, string]> = [["deals", "Deals"], ["demand", "What customers want"], ["briefing", "Market briefing"]];

  return (
    <div>
      <h1>Deals &amp; Market</h1>
      <p className="admin-page-intro">Find cheaper and promotional deals, see what customers want most, and get advice on winning more business.</p>
      <div className="admin-tabs" role="tablist" style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-5)", flexWrap: "wrap" }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "deals" && <DealsTab />}
      {tab === "demand" && <DemandTab />}
      {tab === "briefing" && <BriefingTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ Deals */

interface DealsResponse {
  deals: AdminDeal[];
  counts: Partial<Record<DealStatus, number>>;
  aiAvailable: boolean;
}

function DealsTab() {
  const [status, setStatus] = useState<DealStatus>("NEW");
  const [data, setData] = useState<DealsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    adminApi.get<DealsResponse>(`/deal-admin?status=${status}`).then(setData).catch((err) => setNotice({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't load deals." }));
  }, [status]);
  useEffect(load, [load]);

  async function scan() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await adminApi.post<{ found: number; added: number }>("/deal-admin/scan", {});
      setNotice({ kind: "success", text: result.added > 0 ? `Found ${result.added} new deal(s) for you to review.` : result.found > 0 ? "Everything found was already in your list." : "No solid deals found this time." });
      setStatus("NEW");
      load();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : "The search failed." });
    } finally {
      setBusy(false);
    }
  }

  const statuses: Array<[DealStatus, string]> = [["NEW", "To review"], ["PUBLISHED", "Published"], ["DISMISSED", "Dismissed"]];

  return (
    <div>
      <div className="form-status form-status--info" role="note">
        Deals found by the AI come from live web searches and <strong>haven't been verified</strong>. Check the price, dates and availability with the seller before you publish. Visitors never see where a deal came from.
      </div>

      {notice && <FormStatusBanner status={notice.kind} successMessage={notice.text} errorMessage={notice.text} />}

      <div className="admin-toolbar">
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          {statuses.map(([id, label]) => (
            <button key={id} className={status === id ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"} onClick={() => setStatus(id)}>
              {label} ({data?.counts[id] ?? 0})
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => setAdding((v) => !v)}>{adding ? "Cancel" : "Add a deal"}</button>
          <button className="btn btn-primary" onClick={scan} disabled={busy || data?.aiAvailable === false} title={data?.aiAvailable === false ? "Set GEMINI_API_KEY to enable" : undefined}>
            {busy ? "Searching the internet…" : "Search the internet for deals"}
          </button>
        </div>
      </div>

      {adding && <NewDealForm onSaved={() => { setAdding(false); setStatus("NEW"); load(); }} />}

      {data && data.deals.length === 0 && <p className="text-muted">Nothing here yet.</p>}
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        {data?.deals.map((deal) => (
          <DealEditor key={deal.id} deal={deal} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function NewDealForm({ onSaved }: { onSaved: () => void }) {
  const [values, setValues] = useState({ title: "", summary: "", priceUsd: "", vehicleLabel: "", validUntil: "", howToGet: "" });
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await adminApi.post("/deal-admin", {
        title: values.title,
        summary: values.summary,
        priceUsd: values.priceUsd ? Number(values.priceUsd) : undefined,
        vehicleLabel: values.vehicleLabel || undefined,
        validUntil: values.validUntil || undefined,
        howToGet: values.howToGet || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save the deal.");
    }
  }

  return (
    <form className="form-card" onSubmit={save} noValidate style={{ marginBottom: "var(--space-5)" }}>
      <h2>Add a deal</h2>
      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      <div className="form-grid form-grid--2col">
        <FormField id="nd-title" label="Title" required value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
        <FormField id="nd-vehicle" label="Vehicle (optional)" value={values.vehicleLabel} onChange={(e) => setValues({ ...values, vehicleLabel: e.target.value })} />
        <FormField id="nd-price" label="Price (USD, optional)" type="number" value={values.priceUsd} onChange={(e) => setValues({ ...values, priceUsd: e.target.value })} />
        <FormField id="nd-until" label="Valid until (optional)" type="date" value={values.validUntil} onChange={(e) => setValues({ ...values, validUntil: e.target.value })} />
        <FormField id="nd-summary" label="Description customers will read" as="textarea" required wrapperClassName="form-grid__full" value={values.summary} onChange={(e) => setValues({ ...values, summary: e.target.value })} />
        <FormField id="nd-how" label="How to get it (only you see this)" as="textarea" wrapperClassName="form-grid__full" value={values.howToGet} onChange={(e) => setValues({ ...values, howToGet: e.target.value })} />
      </div>
      <div className="form-actions"><button className="btn btn-primary" type="submit">Save deal</button></div>
    </form>
  );
}

/** One deal: editable wording, staff-only notes and sources, and the publish / dismiss buttons. */
function DealEditor({ deal, onChanged }: { deal: AdminDeal; onChanged: () => void }) {
  const [values, setValues] = useState({
    title: deal.title,
    summary: deal.summary,
    priceUsd: deal.priceUsd ? String(deal.priceUsd) : "",
    vehicleLabel: deal.vehicleLabel ?? "",
    validUntil: deal.validUntil ? deal.validUntil.slice(0, 10) : "",
    howToGet: deal.howToGet,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Saves the edits, then (optionally) runs a status action. Publishing always saves what's on screen first. */
  async function act(action?: "publish" | "unpublish" | "dismiss") {
    setError(null);
    setSaved(false);
    try {
      await adminApi.patch(`/deal-admin/${deal.id}`, {
        title: values.title,
        summary: values.summary,
        priceUsd: values.priceUsd ? Number(values.priceUsd) : null,
        vehicleLabel: values.vehicleLabel || null,
        validUntil: values.validUntil || null,
        howToGet: values.howToGet,
      });
      if (action) await adminApi.post(`/deal-admin/${deal.id}/${action}`, {});
      setSaved(true);
      if (action) onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    }
  }

  async function remove() {
    try {
      await adminApi.delete(`/deal-admin/${deal.id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete.");
    }
  }

  return (
    <div className="form-card">
      <p className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>
        {deal.origin === "ai" ? "Found by the AI search" : "Added by hand"} · {new Date(deal.createdAt).toLocaleDateString()}
        {deal.priceUsd ? <> · <Price amount={deal.priceUsd} currency="USD" layout="inline" /></> : null}
      </p>
      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      {saved && <FormStatusBanner status="success" successMessage="Saved." errorMessage={null} />}
      <div className="form-grid form-grid--2col">
        <FormField id={`t-${deal.id}`} label="Title" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} />
        <FormField id={`v-${deal.id}`} label="Vehicle" value={values.vehicleLabel} onChange={(e) => setValues({ ...values, vehicleLabel: e.target.value })} />
        <FormField id={`p-${deal.id}`} label="Price (USD)" type="number" value={values.priceUsd} onChange={(e) => setValues({ ...values, priceUsd: e.target.value })} />
        <FormField id={`u-${deal.id}`} label="Valid until" type="date" value={values.validUntil} onChange={(e) => setValues({ ...values, validUntil: e.target.value })} />
        <FormField id={`s-${deal.id}`} label="What customers will read (no company names or links)" as="textarea" wrapperClassName="form-grid__full" value={values.summary} onChange={(e) => setValues({ ...values, summary: e.target.value })} />
        <FormField id={`h-${deal.id}`} label="How to get it — only you see this" as="textarea" wrapperClassName="form-grid__full" value={values.howToGet} onChange={(e) => setValues({ ...values, howToGet: e.target.value })} />
      </div>
      {deal.sources.length > 0 && (
        <details style={{ marginTop: "var(--space-3)" }}>
          <summary className="text-muted">Where this was found — only you see this ({deal.sources.length})</summary>
          <ul style={{ paddingLeft: "var(--space-5)", listStyle: "disc", fontSize: "var(--fs-sm)" }}>
            {deal.sources.map((source) => (<li key={source} style={{ overflowWrap: "anywhere" }}>{source}</li>))}
          </ul>
        </details>
      )}
      <div className="form-actions" style={{ flexWrap: "wrap" }}>
        <button className="btn btn-secondary" onClick={() => act()}>Save changes</button>
        {deal.status !== "PUBLISHED" && <button className="btn btn-primary" onClick={() => act("publish")}>Publish to the site</button>}
        {deal.status === "PUBLISHED" && <button className="btn btn-secondary" onClick={() => act("unpublish")}>Take off the site</button>}
        {deal.status === "NEW" && <button className="btn btn-ghost" onClick={() => act("dismiss")}>Dismiss</button>}
        {confirmDelete ? (
          <button className="btn btn-ghost" onClick={remove}>Really delete</button>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Demand */

interface DemandRow {
  name: string;
  score: number;
  importRequests: number;
  inquiries: number;
  saves: number;
  likes: number;
  views: number;
  inStock: number;
  advice: string;
}

function DemandTab() {
  const [data, setData] = useState<{ windowDays: number; rows: DemandRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminApi.get<{ windowDays: number; rows: DemandRow[] }>("/market/demand").then(setData).catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load."));
  }, []);

  if (error) return <FormStatusBanner status="error" successMessage="" errorMessage={error} />;
  if (!data) return <p className="text-muted">Loading…</p>;
  return (
    <div className="form-card">
      <h2>What your customers want most</h2>
      <p className="text-muted">Built from your own numbers over the last {data.windowDays} days: import requests count most, then inquiries, saved vehicles, likes and views.</p>
      {data.rows.length === 0 ? (
        <p className="text-muted">Not enough activity yet. As customers browse, save and enquire, the ranking appears here.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Vehicle</th><th>Score</th><th>Import requests</th><th>Inquiries</th><th>Saves</th><th>Likes</th><th>Views</th><th>In stock</th><th>What to do</th></tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.name}>
                  <td><strong>{row.name}</strong></td>
                  <td className="mono">{row.score}</td>
                  <td>{row.importRequests}</td><td>{row.inquiries}</td><td>{row.saves}</td><td>{row.likes}</td><td>{row.views}</td>
                  <td>{row.inStock}</td>
                  <td>{row.advice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Briefing */

interface Report {
  content: {
    headline: string;
    trending: Array<{ name: string; why: string; typicalPriceUsd: number | null }>;
    opportunities: Array<{ action: string; why: string }>;
    standOut: Array<{ idea: string; why: string }>;
  };
  sources: string[];
  createdAt: string;
}

function BriefingTab() {
  const [report, setReport] = useState<Report | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get<{ report: Report | null; aiAvailable: boolean }>("/market/report").then((r) => { setReport(r.report); setAiAvailable(r.aiAvailable); }).catch(() => undefined);
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setReport(await adminApi.post<Report>("/market/report", {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the briefing.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <h2>Market briefing</h2>
      <p className="text-muted">What's selling in Malawi and the region right now, and how to do better than other importers and dealers. Researched on the internet and combined with your own demand numbers. Treat it as guidance, not fact.</p>
      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      <div className="form-actions">
        <button className="btn btn-primary" onClick={generate} disabled={busy || !aiAvailable}>{busy ? "Researching… this can take a minute" : report ? "Refresh the briefing" : "Create a briefing"}</button>
        {report && <span className="text-muted">Last updated {new Date(report.createdAt).toLocaleString()}</span>}
      </div>
      {report && (
        <div style={{ marginTop: "var(--space-5)", display: "grid", gap: "var(--space-5)" }}>
          <p><strong>{report.content.headline}</strong></p>
          <section>
            <h3>What's selling</h3>
            <ul style={{ listStyle: "disc", paddingLeft: "var(--space-5)" }}>
              {report.content.trending.map((item) => (
                <li key={item.name}><strong>{item.name}</strong>{item.typicalPriceUsd ? <> (about <Price amount={item.typicalPriceUsd} currency="USD" layout="inline" />)</> : null} — {item.why}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>What to look into</h3>
            <ul style={{ listStyle: "disc", paddingLeft: "var(--space-5)" }}>
              {report.content.opportunities.map((item) => (<li key={item.action}><strong>{item.action}</strong> — {item.why}</li>))}
            </ul>
          </section>
          <section>
            <h3>How to stand out from other companies</h3>
            <ul style={{ listStyle: "disc", paddingLeft: "var(--space-5)" }}>
              {report.content.standOut.map((item) => (<li key={item.idea}><strong>{item.idea}</strong> — {item.why}</li>))}
            </ul>
          </section>
          {report.sources.length > 0 && (
            <details>
              <summary className="text-muted">Pages the research used — only you see this ({report.sources.length})</summary>
              <ul style={{ paddingLeft: "var(--space-5)", listStyle: "disc", fontSize: "var(--fs-sm)" }}>
                {report.sources.map((source) => (<li key={source} style={{ overflowWrap: "anywhere" }}>{source}</li>))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
