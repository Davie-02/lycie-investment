/**
 * Finance → Mobile money: every Airtel Money / TNM Mpamba payment made through
 * PayChangu. Successful ones are already credited to the customer's account;
 * "Check again" asks the gateway about a payment still marked waiting.
 */
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import "../components/AdminLayout.css";

interface MobilePayment {
  id: string;
  txRef: string;
  amount: number;
  currency: string;
  purpose: string;
  note: string;
  status: "pending" | "success" | "failed";
  createdAt: string;
  confirmedAt: string | null;
  customer: { id: string; name: string; email: string } | null;
}

interface Summary {
  enabled: boolean;
  received30d: number;
  count30d: number;
  pending: number;
}

const TONE: Record<string, string> = { success: "ws-chip--good", failed: "ws-chip--bad", pending: "ws-chip--warn" };
const LABEL: Record<string, string> = { success: "Paid", failed: "Failed", pending: "Waiting" };

export default function AdminMobilePayments() {
  const { can } = useAdminAuth();
  const [status, setStatus] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading } = useAsyncData(() => adminApi.get<MobilePayment[]>(`/mobile-payments${status ? `?status=${status}` : ""}`), [status, refresh]);
  const { data: summary } = useAsyncData(() => adminApi.get<Summary>("/mobile-payments/summary"), [refresh]);

  async function recheck(payment: MobilePayment) {
    try {
      const result = await adminApi.post<{ status: string }>(`/mobile-payments/${payment.txRef}/recheck`, {});
      setMessage(`${payment.txRef}: ${LABEL[result.status] ?? result.status}.`);
      setRefresh((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't check.");
    }
  }

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Mobile money</h1>
          <p>Payments customers make from their account with Airtel Money or TNM Mpamba. Paid amounts are credited to their account automatically.</p>
        </div>
      </div>

      {summary && !summary.enabled && (
        <p className="form-status form-status--info">
          Mobile money isn't switched on yet. Create a PayChangu business account, then set PAYCHANGU_SECRET_KEY (and optionally
          PAYCHANGU_WEBHOOK_SECRET) on the server. The "Pay with mobile money" option then appears on customers' account pages.
        </p>
      )}
      {summary && (
        <div className="ws-stats ws-section">
          <div className="ws-stat">
            <span className="ws-stat__value">MWK {summary.received30d.toLocaleString()}</span>
            <span className="ws-stat__label">Received in 30 days ({summary.count30d} payments)</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat__value">{summary.pending}</span>
            <span className="ws-stat__label">Waiting for confirmation</span>
          </div>
        </div>
      )}
      {message && <p className="form-status form-status--success" role="status">{message}</p>}

      <div className="ws-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Show">
          <option value="">All payments</option>
          <option value="success">Paid</option>
          <option value="pending">Waiting</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && data.length === 0 && <div className="admin-empty-state">No mobile money payments yet.</div>}
      {data && data.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>For</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((payment) => (
                <tr key={payment.id}>
                  <td>{new Date(payment.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td>
                    {payment.customer?.name ?? "—"}
                    <div className="text-muted">{payment.customer?.email}</div>
                  </td>
                  <td className="mono">
                    {payment.currency} {payment.amount.toLocaleString()}
                  </td>
                  <td>
                    {payment.purpose}
                    {payment.note && <div className="text-muted">{payment.note}</div>}
                  </td>
                  <td className="mono">{payment.txRef}</td>
                  <td>
                    <span className={`ws-chip ${TONE[payment.status]}`}>{LABEL[payment.status]}</span>
                    {payment.status === "pending" && can("finance", "edit") && (
                      <div>
                        <button type="button" className="link-button" onClick={() => void recheck(payment)}>
                          Check again
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
