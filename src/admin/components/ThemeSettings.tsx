import { useState, type FormEvent } from "react";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { THEME_LABELS, THEME_NAMES } from "@/utils/theme";
import type { ThemeContent, ThemeName } from "@/types/siteContent";
import { adminApi } from "../adminApi";

/** Miniature colour previews (page, card, text). The real colours live in styles/variables.css. */
const SWATCHES: Record<ThemeName, { page: string; card: string; text: string }> = {
  classic: { page: "#fafaf8", card: "#ffffff", text: "#1a1b1e" },
  ocean: { page: "#f0f6fb", card: "#ffffff", text: "#13202f" },
  warm: { page: "#f8f3ea", card: "#fffdf8", text: "#2a2419" },
  dark: { page: "#0b1626", card: "#12233a", text: "#e6edf5" },
};

/**
 * Admin → Site Content → Theme. Pick how the public site looks. Whatever you choose, the brand
 * stays: the navy and sky-blue colours, the logo, and the header, footer and buttons are the same in
 * every theme — only page and card tones change. The admin dashboard itself always stays Classic.
 */
export default function ThemeSettings({ initial, onSaved }: { initial: ThemeContent; onSaved: () => void }) {
  const [values, setValues] = useState<ThemeContent>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      await adminApi.patch("/site-content/theme", { value: values });
      setStatus("success");
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the theme.");
      setStatus("error");
    }
  }

  return (
    <form id="site-content-theme" className="form-card" onSubmit={save} noValidate>
      <h2>Theme</h2>
      <p className="text-muted">
        Choose the look of the public site. The brand colours, logo, header, footer and buttons stay the same in every theme.
      </p>
      {status === "success" && <FormStatusBanner status="success" successMessage="Theme updated. Visitors see it straight away." errorMessage={null} />}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div role="radiogroup" aria-label="Site theme" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        {THEME_NAMES.map((name) => {
          const swatch = SWATCHES[name];
          const selected = values.defaultTheme === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setValues({ ...values, defaultTheme: name })}
              style={{
                textAlign: "left",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: selected ? "2px solid var(--color-accent-dark)" : "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <span style={{ display: "block", background: swatch.page, borderRadius: 4, padding: 8, marginBottom: 8 }}>
                <span style={{ display: "block", background: "#19406c", height: 10, borderRadius: 2, marginBottom: 6 }} />
                <span style={{ display: "block", background: swatch.card, border: "1px solid rgba(128,128,128,.25)", borderRadius: 3, padding: 6 }}>
                  <span style={{ display: "block", background: swatch.text, height: 5, width: "70%", borderRadius: 2, marginBottom: 4 }} />
                  <span style={{ display: "block", background: "#76cae9", height: 5, width: "40%", borderRadius: 2 }} />
                </span>
              </span>
              <strong style={{ fontSize: "var(--fs-sm)" }}>{THEME_LABELS[name].split(" — ")[0]}</strong>
              <span className="text-muted" style={{ display: "block", fontSize: "var(--fs-xs)" }}>{THEME_LABELS[name].split(" — ")[1]}</span>
            </button>
          );
        })}
      </div>

      <label className="form-check" style={{ marginBottom: "var(--space-3)" }}>
        <input type="checkbox" checked={values.allowVisitorSwitch} onChange={(e) => setValues({ ...values, allowVisitorSwitch: e.target.checked })} />
        <span>Show a light / dark switch in the header so visitors can choose</span>
      </label>
      <label className="form-check">
        <input
          type="checkbox"
          checked={values.followDeviceDarkMode}
          disabled={!values.allowVisitorSwitch}
          onChange={(e) => setValues({ ...values, followDeviceDarkMode: e.target.checked })}
        />
        <span>Start in dark mode for visitors whose device is set to dark mode</span>
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save theme"}
        </button>
      </div>
    </form>
  );
}
