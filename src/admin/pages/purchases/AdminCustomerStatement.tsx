/**
 * Finance → one customer's statement: their totals (bought, paid, owed,
 * saved), every purchase with its payments, proofs waiting for approval, and
 * their account balance with its ledger. Printable, and a new purchase can be
 * recorded for them from here.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { PAYMENT_METHODS, PAYMENT_STATUS_LABELS, PRICING_LABELS, PURCHASE_TYPES, money, paymentTone, type PaymentStatus } from "@/utils/purchases";
import { adminApi } from "../../adminApi";
import { useAdminAuth } from "../../context/AdminAuthContext";
import PurchaseForm from "./PurchaseForm";
import { chipTone } from "./ui";
import type { CustomerAccountRow } from "./types";
import "../../components/AdminLayout.css";
import "./purchases.css";

interface StatementPurchase {
  id: string;
  reference: string;
  type: string;
  title: string;
  currency: string;
  pricing: string;
  offerName: string | null;
  discountAmount: string;
  total: string;
  amountPaid: string;
  balance: string;
  paymentStatus: PaymentStatus;
  status: string;
  purchasedAt: string;
  dueDate: string | null;
  payments: Array<{ id: string; kind: string; amount: string; method: string; reference: string | null; paidAt: string; voidedAt: string | null }>;
}

interface Statement {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  account: {
    balance: string;
    currency: string;
    transactions: Array<{ id: string; type: "DEPOSIT" | "WITHDRAWAL"; amount: string; currency: string; reference: string; description: string | null; createdAt: string }>;
  } | null;
  purchases: StatementPurchase[];
  paymentSubmissions: Array<{ id: string; amount: string; currency: string; reference: string; createdAt: string; purchaseId: string | null }>;
  totals: CustomerAccountRow["totals"];
}

export default function AdminCustomerStatement() {
  const { customerId = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAdminAuth();
  const [creating, setCreating] = useState(false);
  const { data: s, isLoading, error } = useAsyncData(() => adminApi.get<Statement>(`/purchases/customers/${customerId}`), [customerId], ["purchases"]);

  if (isLoading && !s) return <p className="text-muted">Loading…</p>;
  if (error || !s) return <p className="form-status form-status--error">{error ?? "Customer not found."}</p>;

  // Every money event in date order, newest first.
  const events = [
    ...s.purchases.flatMap((p) =>
      p.payments
        .filter((pay) => !pay.voidedAt)
        .map((pay) => ({
          key: pay.id,
          date: pay.paidAt,
          what: `${pay.kind === "refund" ? "Refund" : "Payment"} · ${PAYMENT_METHODS[pay.method] ?? pay.method}`,
          ref: p.reference,
          amount: `${pay.kind === "refund" ? "−" : ""}${money(pay.amount, p.currency)}`,
        }))
    ),
    ...s.purchases.map((p) => ({ key: `p-${p.id}`, date: p.purchasedAt, what: `Purchase · ${p.title}`, ref: p.reference, amount: money(p.total, p.currency) })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="purchase-detail">
      <p className="purchase-detail__back no-print">
        <Link to="/admin/customer-accounts">← All customer accounts</Link>
      </p>
      <div className="ws-hero">
        <div>
          <h1>{s.name}</h1>
          <p>
            {s.email}
            {s.phone ? ` · ${s.phone}` : ""} · customer since {new Date(s.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="admin-table__actions no-print">
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            Print statement
          </button>
          {can("finance", "edit") && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              + Record a purchase
            </button>
          )}
        </div>
      </div>

      {creating && (
        <PurchaseForm
          presetCustomer={{ id: s.id, name: s.name, email: s.email }}
          onDone={(saved) => {
            setCreating(false);
            if (saved) navigate(`/admin/purchases/${saved.id}`);
          }}
        />
      )}

      <section className="ws-section">
        <div className="ws-stats">
          {s.totals.map((t) => (
            <div key={t.currency} className="ws-stat">
              <span className="ws-stat__value">{money(t.purchased, t.currency)}</span>
              <span className="ws-stat__label">Bought</span>
            </div>
          ))}
          {s.totals.map((t) => (
            <div key={`paid-${t.currency}`} className="ws-stat">
              <span className="ws-stat__value">{money(t.paid, t.currency)}</span>
              <span className="ws-stat__label">Paid</span>
            </div>
          ))}
          {s.totals.map((t) => (
            <div key={`owed-${t.currency}`} className={Number(t.owed) > 0 ? "ws-stat ws-stat--attention" : "ws-stat"}>
              <span className="ws-stat__value">{money(t.owed, t.currency)}</span>
              <span className="ws-stat__label">Still owes</span>
            </div>
          ))}
          {s.totals
            .filter((t) => Number(t.saved) > 0)
            .map((t) => (
              <div key={`saved-${t.currency}`} className="ws-stat">
                <span className="ws-stat__value">{money(t.saved, t.currency)}</span>
                <span className="ws-stat__label">Saved on deals & discounts</span>
              </div>
            ))}
          <div className="ws-stat">
            <span className="ws-stat__value">{s.account ? money(s.account.balance, s.account.currency) : "—"}</span>
            <span className="ws-stat__label">Account balance</span>
          </div>
        </div>
      </section>

      {s.paymentSubmissions.length > 0 && (
        <p className="form-status form-status--info no-print">
          {s.paymentSubmissions.length} payment proof{s.paymentSubmissions.length === 1 ? " is" : "s are"} waiting for approval. <Link to="/admin/payments">Review →</Link>
        </p>
      )}

      <section className="form-card">
        <h2 className="purchase-detail__h">Purchases</h2>
        {s.purchases.length === 0 ? (
          <p className="text-muted">No purchases yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table purchase-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>What</th>
                  <th>Pricing</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.purchases.map((p) => (
                  <tr key={p.id} className="purchase-table__row" onClick={() => navigate(`/admin/purchases/${p.id}`)}>
                    <td>
                      {new Date(p.purchasedAt).toLocaleDateString()}
                      <div className="text-muted mono">{p.reference}</div>
                    </td>
                    <td>
                      <Link to={`/admin/purchases/${p.id}`} onClick={(e) => e.stopPropagation()}>
                        <strong>{p.title}</strong>
                      </Link>
                      <div className="text-muted">{PURCHASE_TYPES[p.type] ?? p.type}</div>
                    </td>
                    <td>
                      {p.pricing === "standard" ? <span className="text-muted">Standard</span> : <span className="ws-chip purchase-chip--offer">{PRICING_LABELS[p.pricing]}</span>}
                      {p.offerName && <div className="text-muted">{p.offerName}</div>}
                      {Number(p.discountAmount) > 0 && <div className="text-muted">−{money(p.discountAmount, p.currency)}</div>}
                    </td>
                    <td className="num">{money(p.total, p.currency)}</td>
                    <td className="num">{money(p.amountPaid, p.currency)}</td>
                    <td className={Number(p.balance) > 0 && p.status === "active" ? "num purchase-owed" : "num"}>{money(p.balance, p.currency)}</td>
                    <td>
                      <span className={chipTone(paymentTone(p.paymentStatus))}>{PAYMENT_STATUS_LABELS[p.paymentStatus]}</span>
                      {p.dueDate && p.status === "active" && Number(p.balance) > 0 && <div className="text-muted">due {new Date(p.dueDate).toLocaleDateString()}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {events.length > 0 && (
        <section className="form-card">
          <h2 className="purchase-detail__h">Statement (newest first)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>What</th>
                  <th>Purchase</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.key}>
                    <td>{new Date(e.date).toLocaleDateString()}</td>
                    <td>{e.what}</td>
                    <td className="mono">{e.ref}</td>
                    <td className="num">{e.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {s.account && s.account.transactions.length > 0 && (
        <section className="form-card">
          <h2 className="purchase-detail__h">Account balance history</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.account.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>{t.description ?? (t.type === "DEPOSIT" ? "Money in" : "Money out")}</td>
                    <td className="mono">{t.reference}</td>
                    <td className="num">
                      {t.type === "WITHDRAWAL" ? "−" : "+"}
                      {money(t.amount, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
