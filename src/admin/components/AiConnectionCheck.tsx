import { useState } from "react";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { adminApi } from "../adminApi";

interface Check {
  settings: { models: string[]; backupModels?: string[]; raceAfterMs: number; firstWordDeadlineMs: number };
  results: Array<{ model: string; ok: boolean; ms: number; problem?: string }>;
}

/** Plain-language explanations of the problems Google can report. */
function explain(problem: string): string {
  if (/quota/i.test(problem)) return "out of free quota for now (Google resets daily; billing removes the limit)";
  if (/server error/i.test(problem)) return "Google's server is overloaded right now";
  if (/not available/i.test(problem)) return "this model isn't available to your key any more";
  if (/timed out|no first word/i.test(problem)) return "too slow to answer";
  if (/key/i.test(problem)) return "your API key was rejected";
  return problem;
}

/**
 * "Check AI connection": asks every AI model a tiny question right now, from the live server, and shows which
 * work and how fast. This is the quickest way to see WHY answers are slow or Lycie says she's having trouble
 * (out of quota, overloaded, bad key…). Uses a handful of tiny requests.
 */
export default function AiConnectionCheck() {
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setCheck(await adminApi.post<Check>("/lycie/diagnose", {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The check couldn't run.");
    } finally {
      setBusy(false);
    }
  }

  const working = check?.results.filter((r) => r.ok).length ?? 0;
  return (
    <div className="form-card" style={{ marginBottom: "var(--space-6)" }}>
      <h2>AI connection check</h2>
      <p className="text-muted">Tests every AI model right now, so you can see what is slow or not working.</p>
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={run} disabled={busy}>{busy ? "Testing… (up to 15 seconds)" : "Check now"}</button>
      </div>
      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
      {check && (
        <>
          <p style={{ marginTop: "var(--space-4)" }}>
            <strong>{working} of {check.results.length} models working.</strong>{" "}
            <span className="text-muted">If one is slow, the next is started after {check.settings.raceAfterMs / 1000}s and the first answer wins.</span>{" "}
            <span className="text-muted">
              {check.settings.backupModels?.length
                ? "Models marked groq: are the backup — used for chat and writing when Gemini is out of quota or down."
                : "No backup AI is set up (GROQ_API_KEY)."}
            </span>
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Model</th><th>Result</th><th>Time</th></tr></thead>
              <tbody>
                {check.results.map((r) => (
                  <tr key={r.model}>
                    <td className="mono">{r.model}</td>
                    <td>{r.ok ? "✓ working" : `✗ ${explain(r.problem ?? "failed")}`}</td>
                    <td className="mono">{(r.ms / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
