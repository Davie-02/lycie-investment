/**
 * Finance → Referrals: customers who joined through a friend's link. Once the
 * new customer has done business with us, reward the friend — the amount is
 * credited to their account balance.
 */
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import "../components/AdminLayout.css";

interface Referral {
  id: string;
  status: "pending" | "rewarded" | "declined";
  rewardAmount: number | null;
  rewardNote: string | null;
  createdAt: string;
  referrer: { name: string; email: string };
  referred: { name: string; email: string; createdAt: string };
  referredActivity: number;
}

const TONE: Record<string, string> = { rewarded: "ws-chip--good", declined: "ws-chip--bad", pending: "ws-chip--warn" };

export default function AdminReferrals() {
  const { can } = useAdminAuth();
  const canEdit = can("finance", "edit");
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const { data, isLoading } = useAsyncData(() => adminApi.get<Referral[]>("/referrals"), [refresh]);

  async function reward(referral: Referral) {
    const raw = window.prompt(`Reward for ${referral.referrer.name} (amount in MWK, credited to their account):`, "10000");
    if (!raw) return;
    const amount = Math.round(Number(raw.replace(/[^\d.]/g, "")));
    if (!amount) return;
    try {
      await adminApi.post(`/referrals/${referral.id}/reward`, { amount, note: `for inviting ${referral.referred.name}` });
      setMessage(`MWK ${amount.toLocaleString()} credited to ${referral.referrer.name}.`);
      setRefresh((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't reward.");
    }
  }

  async function decline(referral: Referral) {
    try {
      await adminApi.post(`/referrals/${referral.id}/decline`, {});
      setRefresh((n) => n + 1);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>Referrals</h1>
          <p>Every customer has a share link on their account page. Reward them once the friend they brought does business with us.</p>
        </div>
      </div>
      {message && <p className="form-status form-status--success" role="status">{message}</p>}
      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && data.length === 0 && <div className="admin-empty-state">No referrals yet.</div>}
      {data && data.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Invited by</th>
                <th>New customer</th>
                <th>Their activity</th>
                <th>Status</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {data.map((referral) => (
                <tr key={referral.id}>
                  <td>
                    {referral.referrer.name}
                    <div className="text-muted">{referral.referrer.email}</div>
                  </td>
                  <td>
                    {referral.referred.name}
                    <div className="text-muted">joined {new Date(referral.referred.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td>
                    {referral.referredActivity > 0 ? (
                      <span className="ws-chip ws-chip--good">{referral.referredActivity} requests/payments</span>
                    ) : (
                      <span className="text-muted">Nothing yet</span>
                    )}
                  </td>
                  <td>
                    <span className={`ws-chip ${TONE[referral.status]}`}>{referral.status}</span>
                    {referral.rewardAmount && <div className="text-muted">MWK {referral.rewardAmount.toLocaleString()}</div>}
                  </td>
                  {canEdit && (
                    <td>
                      {referral.status === "pending" && (
                        <div className="admin-table__actions">
                          <button type="button" className="btn btn-primary" onClick={() => void reward(referral)}>
                            Reward
                          </button>
                          <button type="button" className="btn-ghost" onClick={() => void decline(referral)}>
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
