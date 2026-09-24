/**
 * My work & leave: every staff member's own page — their profile and access,
 * and their leave requests (request, see decisions, cancel).
 */
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import FormField from "@/components/forms/FormField";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { LEVEL_LABELS, MODULE_KEYS } from "../access";
import { MODULES } from "../modules";
import { LEAVE_TONE, LEAVE_TYPE_LABEL, day, type LeaveRequest } from "./AdminLeave";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function MyAccount() {
  const { currentUser, isSystemAdmin } = useAdminAuth();
  const [refresh, setRefresh] = useState(0);
  const { data: leave } = useAsyncData(() => adminApi.get<LeaveRequest[]>("/hr/leave/me"), [refresh]);
  const [form, setForm] = useState({ type: "annual", startDate: todayKey(), endDate: todayKey(), reason: "" });
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await adminApi.post("/hr/leave/me", form);
      setStatus({ tone: "ok", text: "Leave requested. You'll get an email when it's decided." });
      setForm((prev) => ({ ...prev, reason: "" }));
      setRefresh((n) => n + 1);
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Couldn't send." });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      await adminApi.post(`/hr/leave/me/${id}/cancel`, {});
      setRefresh((n) => n + 1);
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Couldn't cancel." });
    }
  }

  const granted = MODULE_KEYS.filter((key) => isSystemAdmin || (currentUser?.access?.[key] ?? "none") !== "none");

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>My work & leave</h1>
          <p>
            {currentUser?.name}
            {currentUser?.jobTitle ? ` · ${currentUser.jobTitle}` : ""} · {currentUser?.email}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/admin/security">
          Password & two-step sign-in
        </Link>
      </div>

      <section className="ws-section">
        <div className="ws-section__head">
          <h2>What I can use</h2>
        </div>
        {granted.length === 0 ? (
          <p className="text-muted">No department modules yet — ask your system administrator.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {granted.map((key) => (
              <span key={key} className="ws-chip">
                {MODULES.find((m) => m.key === key)?.label}: {isSystemAdmin ? "Everything" : LEVEL_LABELS[currentUser!.access![key]]}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="ws-section">
        <form className="form-card" onSubmit={submit} noValidate>
          <h2 style={{ marginTop: 0 }}>Request leave</h2>
          {status && <p className={status.tone === "ok" ? "form-status form-status--success" : "form-status form-status--error"} role="status">{status.text}</p>}
          <div className="form-grid form-grid--2col">
            <FormField as="select" id="leave-type" label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(LEAVE_TYPE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </FormField>
            <div />
            <FormField id="leave-start" label="First day" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <FormField id="leave-end" label="Last day" type="date" required min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <FormField as="textarea" id="leave-reason" label="Note (optional)" wrapperClassName="form-grid__full" value={form.reason} maxLength={1000} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Sending…" : "Request leave"}
            </button>
          </div>
        </form>
      </section>

      <section className="ws-section">
        <div className="ws-section__head">
          <h2>My requests</h2>
        </div>
        {!leave || leave.length === 0 ? (
          <p className="text-muted">No leave requested yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leave.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {day(item.startDate)} – {day(item.endDate)} <span className="text-muted">({item.days} days)</span>
                    </td>
                    <td>{LEAVE_TYPE_LABEL[item.type]}</td>
                    <td>
                      <span className={`ws-chip ${LEAVE_TONE[item.status]}`}>{item.status}</span>
                      {item.reviewNote && <div className="text-muted">{item.reviewNote}</div>}
                    </td>
                    <td>
                      {(item.status === "pending" || (item.status === "approved" && new Date(item.startDate) > new Date())) && (
                        <button type="button" className="btn-ghost" onClick={() => void cancel(item.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
