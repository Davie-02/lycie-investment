/**
 * People (HR) → Leave: everyone's leave requests, who's away today, and
 * approve/decline (HR edit access). The employee is emailed the decision.
 */
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

export interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
  employee?: { id: string; name: string; department: string | null; jobTitle: string | null };
}

export const LEAVE_TYPE_LABEL: Record<string, string> = { annual: "Annual", sick: "Sick", family: "Family", unpaid: "Unpaid", other: "Other" };
export const LEAVE_TONE: Record<string, string> = { pending: "ws-chip--warn", approved: "ws-chip--good", declined: "ws-chip--bad", cancelled: "" };
export const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

interface Summary {
  staff: number;
  pendingLeave: number;
  awayToday: Array<{ name: string; department: string | null; until: string }>;
  invitesOutstanding: number;
}

export default function AdminLeave() {
  const { can, currentUser } = useAdminAuth();
  const canDecide = can("hr", "edit");
  const [status, setStatus] = useState("pending");
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading } = useAsyncData(() => adminApi.get<LeaveRequest[]>(`/hr/leave${status ? `?status=${status}` : ""}`), [status, refresh]);
  const { data: summary } = useAsyncData(() => adminApi.get<Summary>("/hr/summary"), [refresh]);

  async function decide(leave: LeaveRequest, decision: "approved" | "declined") {
    const note = decision === "declined" ? window.prompt("Reason for declining (sent to the employee):") ?? undefined : undefined;
    try {
      await adminApi.patch(`/hr/leave/${leave.id}`, { status: decision, note: note || undefined });
      setMessage(`${leave.employee?.name}'s leave was ${decision}.`);
      setRefresh((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Leave</h1>
          <p>Approve or decline requests and see who's away.</p>
        </div>
      </div>

      {summary && (
        <div className="ws-stats ws-section">
          <div className="ws-stat">
            <span className="ws-stat__value">{summary.pendingLeave}</span>
            <span className="ws-stat__label">Waiting for a decision</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat__value">{summary.awayToday.length}</span>
            <span className="ws-stat__label">Away today</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat__value">{summary.staff}</span>
            <span className="ws-stat__label">Active staff</span>
          </div>
        </div>
      )}
      {summary && summary.awayToday.length > 0 && (
        <p className="text-muted">
          Away today: {summary.awayToday.map((a) => `${a.name} (until ${day(a.until)})`).join(", ")}
        </p>
      )}

      {message && <p className="form-status form-status--success" role="status">{message}</p>}

      <div className="ws-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Show">
          <option value="pending">Waiting for a decision</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="cancelled">Cancelled</option>
          <option value="">All</option>
        </select>
      </div>

      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && data.length === 0 && <div className="admin-empty-state">Nothing here.</div>}
      {data && data.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Who</th>
                <th>Dates</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Status</th>
                {canDecide && <th />}
              </tr>
            </thead>
            <tbody>
              {data.map((leave) => (
                <tr key={leave.id}>
                  <td>
                    <strong>{leave.employee?.name}</strong>
                    <div className="text-muted">{leave.employee?.jobTitle}</div>
                  </td>
                  <td>
                    {day(leave.startDate)} – {day(leave.endDate)}
                    <div className="text-muted">{leave.days} working day{leave.days === 1 ? "" : "s"}</div>
                  </td>
                  <td>{LEAVE_TYPE_LABEL[leave.type] ?? leave.type}</td>
                  <td style={{ maxWidth: 260 }}>{leave.reason || "—"}</td>
                  <td>
                    <span className={`ws-chip ${LEAVE_TONE[leave.status]}`}>{leave.status}</span>
                    {leave.reviewedBy && <div className="text-muted">by {leave.reviewedBy}</div>}
                  </td>
                  {canDecide && (
                    <td>
                      {leave.status === "pending" && leave.employee?.id !== currentUser?.id && (
                        <div className="admin-table__actions">
                          <button type="button" className="btn btn-primary" onClick={() => void decide(leave, "approved")}>
                            Approve
                          </button>
                          <button type="button" className="btn-ghost" onClick={() => void decide(leave, "declined")}>
                            Decline
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
