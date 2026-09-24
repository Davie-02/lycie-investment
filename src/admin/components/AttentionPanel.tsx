/**
 * 'Needs your attention' panel on the admin dashboard: counts of things waiting on a
 * person (new requests, pending payments, messages, reviews to moderate) with links to
 * them, plus setup warnings such as email sending not being configured, from GET
 * /api/admin-tools/overview. Refreshes every 30 seconds while open, and has a button to
 * send a test email (POST /api/contact-admin/test-email).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import { useAdminAuth } from "../context/AdminAuthContext";
import "./AttentionPanel.css";

interface Overview {
  attention: Array<{ key: string; label: string; count: number; path: string; urgent?: boolean }>;
  setup: Array<{ key: string; severity: "warning" | "info"; text: string }>;
}

/** What is waiting on a person right now, plus setup problems worth fixing — refreshed while the dashboard is open. */
export default function AttentionPanel() {
  const { isSystemAdmin } = useAdminAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [testState, setTestState] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => {
    adminApi
      .get<Overview>("/admin-tools/overview")
      .then((data) => {
        setOverview(data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    // Keep the numbers fresh while someone is looking at them.
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  async function sendTest() {
    setTesting(true);
    setTestState(null);
    try {
      const result = await adminApi.post<{ to: string }>("/contact-admin/test-email", {});
      setTestState({ ok: true, text: `Test email sent to ${result.to}. Check your inbox (and spam).` });
    } catch (err) {
      setTestState({ ok: false, text: err instanceof ApiError ? err.message : "The test email couldn't be sent." });
    } finally {
      setTesting(false);
    }
  }

  if (failed && !overview) return null; // the dashboard still works without it (e.g. Viewer role)
  if (!overview) return <p className="text-muted">Checking what needs attention…</p>;

  const total = overview.attention.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="attention" aria-label="Needs your attention">
      {overview.setup.map((item) => (
        <div key={item.key} className={`attention__setup attention__setup--${item.severity}`} role="status">
          <span>{item.text}</span>
          {item.key === "email" && isSystemAdmin && (
            <button type="button" className="btn-ghost" onClick={sendTest} disabled={testing}>
              {testing ? "Sending…" : "Send a test email"}
            </button>
          )}
        </div>
      ))}
      {isSystemAdmin && !overview.setup.some((s) => s.key === "email") && (
        <p className="attention__test">
          <button type="button" className="btn-ghost" onClick={sendTest} disabled={testing}>
            {testing ? "Sending…" : "Send a test email to me"}
          </button>
        </p>
      )}
      {testState && (
        <p className={testState.ok ? "attention__ok" : "admin-error-text"} role="status">
          {testState.text}
        </p>
      )}

      <h2 className="attention__title">
        Needs your attention {total > 0 && <span className="attention__total">{total}</span>}
      </h2>
      {overview.attention.length === 0 ? (
        <p className="attention__clear">✓ You're all caught up.</p>
      ) : (
        <ul className="attention__grid">
          {overview.attention.map((item) => (
            <li key={item.key}>
              <Link to={item.path} className={item.urgent ? "attention__tile attention__tile--urgent" : "attention__tile"}>
                <span className="attention__count">{item.count}</span>
                <span className="attention__label">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
