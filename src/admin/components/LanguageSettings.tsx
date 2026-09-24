/**
 * System → System status → Site settings: whether website visitors may switch
 * between English and Chichewa, and which language everyone sees by default.
 * A system setting (needs System edit access), saved as site content "language".
 */
import { useEffect, useState, type FormEvent } from "react";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useSiteContent } from "@/context/SiteContentContext";
import type { LanguageContent } from "@/types/siteContent";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";

export default function LanguageSettings() {
  const { content, refresh } = useSiteContent();
  const { can } = useAdminAuth();
  const canEdit = can("system", "edit");
  const [values, setValues] = useState<LanguageContent>(content.language);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Show the saved setting once site content has loaded.
  useEffect(() => setValues(content.language), [content.language]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/language", { value: values });
      setStatus("saved");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      setStatus("error");
    }
  }

  return (
    <form className="form-card" onSubmit={save}>
      <h3 style={{ marginTop: 0 }}>Website language</h3>
      <p className="text-muted">English and Chichewa are available for the website's menus, footer, sign-in and tracking pages.</p>
      {status === "saved" && <FormStatusBanner status="success" successMessage="Saved — the website updates straight away." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
        <input
          type="checkbox"
          checked={values.allowVisitorSwitch}
          disabled={!canEdit}
          onChange={(e) => setValues({ ...values, allowVisitorSwitch: e.target.checked })}
        />
        Let visitors switch language (shows the EN | NY switch in the header)
      </label>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        Default language
        <select
          value={values.defaultLanguage}
          disabled={!canEdit}
          onChange={(e) => setValues({ ...values, defaultLanguage: e.target.value === "ny" ? "ny" : "en" })}
        >
          <option value="en">English</option>
          <option value="ny">Chichewa</option>
        </select>
      </label>
      <p className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>
        When switching is off, everyone sees the default language, whatever they chose before.
      </p>
      {canEdit ? (
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      ) : (
        <p className="text-muted">Only system administrators can change this.</p>
      )}
    </form>
  );
}
