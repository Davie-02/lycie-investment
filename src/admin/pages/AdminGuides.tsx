/**
 * System → Guides (main system administrator only): the "About this page"
 * descriptions staff see at the top of each workspace page and module
 * overview. Rewrite any of them, and choose who sees each: everyone who can
 * open that area, only system administrators, chosen departments, or nobody.
 * Changes reach everyone's workspace immediately. "Reset" goes back to the
 * built-in text.
 */
import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import FormField from "@/components/forms/FormField";
import { adminApi } from "../adminApi";
import { MODULES, WORKSPACE_PAGES } from "../modules";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

type Audience = "module" | "admins" | "departments" | "hidden";

interface GuideRecord {
  key: string;
  module: string | null;
  title: string;
  body: string;
  audience: Audience;
  departments: string[];
  customized: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  defaultTitle: string;
  defaultBody: string;
  defaultAudience: Audience;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  module: "Everyone who can open this area",
  admins: "System administrators only",
  departments: "Chosen departments only",
  hidden: "Nobody (hidden)",
};

const DEPARTMENTS: Array<[string, string]> = [
  ["management", "Management"],
  ["sales", "Sales"],
  ["hire", "Hire & Fleet"],
  ["imports", "Imports & Clearing"],
  ["finance", "Finance"],
  ["customer_care", "Customer Care"],
  ["marketing", "Marketing"],
  ["hr", "Human Resources"],
  ["general", "General staff"],
];

function groupLabel(module: string | null): string {
  if (!module) return "Everyone's own pages";
  return MODULES.find((m) => m.key === module)?.label ?? module;
}

function where(key: string): string {
  if (key.startsWith("module:")) return "Module overview";
  const path = key.replace(/^page:/, "");
  const page = [...WORKSPACE_PAGES, ...MODULES.flatMap((m) => m.pages)].find((p) => p.path === path);
  return page ? page.label : path.replace("/admin/", "");
}

export default function AdminGuides() {
  const [refresh, setRefresh] = useState(0);
  const { data, isLoading, error } = useAsyncData(() => adminApi.get<GuideRecord[]>("/guides"), [refresh]);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const map = new Map<string, GuideRecord[]>();
    for (const guide of data ?? []) {
      if (term && !`${guide.title} ${guide.body}`.toLowerCase().includes(term)) continue;
      const label = groupLabel(guide.module);
      map.set(label, [...(map.get(label) ?? []), guide]);
    }
    return [...map.entries()];
  }, [data, query]);

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Guides</h1>
          <p>The descriptions staff see at the top of each page. You decide what they say and who sees each one.</p>
        </div>
      </div>
      <div className="ws-toolbar">
        <input type="search" placeholder="Search guides…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search guides" />
      </div>
      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {error && <p className="text-muted" role="alert">{error}</p>}
      {groups.map(([label, guides]) => (
        <section key={label} className="ws-section">
          <div className="ws-section__head">
            <h2>{label}</h2>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Where</th>
                  <th>Guide</th>
                  <th>Who sees it</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {guides.map((guide) =>
                  editing === guide.key ? (
                    <tr key={guide.key}>
                      <td colSpan={4}>
                        <GuideEditor
                          guide={guide}
                          onDone={(changed) => {
                            setEditing(null);
                            if (changed) setRefresh((n) => n + 1);
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={guide.key}>
                      <td>{where(guide.key)}</td>
                      <td style={{ maxWidth: 520 }}>
                        <strong>{guide.title}</strong>
                        <div className="text-muted" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {guide.body}
                        </div>
                        {guide.customized && (
                          <span className="ws-chip ws-chip--warn" title={guide.updatedAt ? new Date(guide.updatedAt).toLocaleString() : undefined}>
                            Edited{guide.updatedBy ? ` by ${guide.updatedBy}` : ""}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={guide.audience === "hidden" ? "ws-chip ws-chip--bad" : guide.audience === "admins" ? "ws-chip ws-chip--warn" : "ws-chip"}>
                          {AUDIENCE_LABEL[guide.audience]}
                        </span>
                        {guide.audience === "departments" && (
                          <div className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>
                            {guide.departments.map((d) => DEPARTMENTS.find(([key]) => key === d)?.[1] ?? d).join(", ")}
                          </div>
                        )}
                      </td>
                      <td>
                        <button type="button" className="btn btn-secondary" onClick={() => setEditing(guide.key)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function GuideEditor({ guide, onDone }: { guide: GuideRecord; onDone: (changed: boolean) => void }) {
  const [title, setTitle] = useState(guide.title);
  const [body, setBody] = useState(guide.body);
  const [audience, setAudience] = useState<Audience>(guide.audience);
  const [departments, setDepartments] = useState<string[]>(guide.departments);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.put(`/guides/${encodeURIComponent(guide.key)}`, { title, body, audience, departments });
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("Go back to the built-in text and audience for this guide?")) return;
    setBusy(true);
    try {
      await adminApi.delete(`/guides/${encodeURIComponent(guide.key)}`);
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset.");
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}
      <div className="form-grid">
        <FormField id={`guide-title-${guide.key}`} label="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <FormField
          as="textarea"
          id={`guide-body-${guide.key}`}
          label="Description (leave a blank line between paragraphs)"
          rows={6}
          value={body}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
        />
        <FormField as="select" id={`guide-audience-${guide.key}`} label="Who sees it" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
          {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((key) => (
            <option key={key} value={key}>
              {AUDIENCE_LABEL[key]}
            </option>
          ))}
        </FormField>
        {audience === "departments" && (
          <fieldset className="site-content-fieldset">
            <legend>Departments</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {DEPARTMENTS.map(([key, label]) => (
                <label key={key} style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={departments.includes(key)}
                    onChange={(e) => setDepartments((prev) => (e.target.checked ? [...prev, key] : prev.filter((d) => d !== key)))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>They also need access to this area to see its guide.</p>
          </fieldset>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => onDone(false)}>
          Cancel
        </button>
        {guide.customized && (
          <button type="button" className="btn-ghost" onClick={() => void reset()}>
            Reset to built-in text
          </button>
        )}
      </div>
    </div>
  );
}
