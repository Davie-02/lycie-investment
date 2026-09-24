/**
 * Admin → Payments. Lists customers' proof-of-payment submissions; Finance
 * approves or rejects with a note via POST /api/financial/payments/:id/approve|reject.
 * Approving a proof sent for a purchase pays that purchase (asking for the
 * amount in the purchase's currency when it differs); otherwise it credits
 * the customer's account balance.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { money } from "@/utils/purchases";
import { adminApi, resolveUploadUrl } from "../adminApi";

interface PaymentSubmission {
  id: string;
  amount: string;
  currency: string;
  proofUrl: string;
  reference: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  customer: { id: string; name: string; email: string };
  createdAt: string;
  purchase: { id: string; reference: string; title: string; currency: string; total: string; amountPaid: string } | null;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadPayments() {
    try {
      setPayments(await adminApi.get<PaymentSubmission[]>("/financial/payments?status=PENDING"));
    } catch {
      setErrorMessage("Unable to load payment submissions.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments();
  }, []);

  async function review(payment: PaymentSubmission, action: "approve" | "reject") {
    const paymentId = payment.id;
    // A proof in kwacha for a dollar purchase: confirm what it's worth in dollars (today's rate is suggested).
    let creditAmount: number | undefined;
    if (action === "approve" && payment.purchase && payment.purchase.currency !== payment.currency) {
      const { rate } = await adminApi.get<{ rate: string | null }>(`/purchases/rate?from=${payment.purchase.currency}&to=${payment.currency}`).catch(() => ({ rate: null }));
      const suggested = rate ? (Number(payment.amount) / Number(rate)).toFixed(2) : "";
      const raw = window.prompt(`How much is ${payment.currency} ${Number(payment.amount).toLocaleString()} in ${payment.purchase.currency}? (paid toward ${payment.purchase.reference})`, suggested);
      if (raw === null) return;
      creditAmount = Number(raw.replace(/[^\d.]/g, ""));
      if (!(creditAmount > 0)) return;
    }
    const note = window.prompt(action === "approve" ? "Optional approval note" : "Reason for rejection");
    if (action === "reject" && !note?.trim()) return;

    try {
      await adminApi.post(`/financial/payments/${paymentId}/${action}`, { note: note?.trim() || undefined, creditAmount });
      setPayments((current) => current.filter((payment) => payment.id !== paymentId));
    } catch {
      setErrorMessage("Unable to review this payment. It may already have been reviewed.");
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-eyebrow">Accounts office</p>
          <h1>Payment submissions</h1>
          <p className="text-muted">Review proof before any customer balance is changed.</p>
        </div>
      </div>

      {errorMessage && <p className="admin-error" role="alert">{errorMessage}</p>}
      {isLoading && <p>Loading payment submissions...</p>}
      {!isLoading && payments.length === 0 && <p className="admin-empty-state">No payments are waiting for review.</p>}
      <div className="admin-list">
        {payments.map((payment) => (
          <article className="admin-list__item" key={payment.id}>
            <div>
              <h2>{payment.customer.name}</h2>
              <p className="text-muted">{payment.customer.email}</p>
              <p className="mono">{payment.reference} · {payment.currency} {payment.amount}</p>
              {payment.note && <p>{payment.note}</p>}
              {payment.purchase ? (
                <p>
                  For purchase{" "}
                  <Link to={`/admin/purchases/${payment.purchase.id}`}>
                    {payment.purchase.reference} — {payment.purchase.title}
                  </Link>{" "}
                  <span className="text-muted">(balance {money(Number(payment.purchase.total) - Number(payment.purchase.amountPaid), payment.purchase.currency)})</span>
                </p>
              ) : (
                <p className="text-muted">Goes to their account balance</p>
              )}
            </div>
            <div className="admin-list__actions">
              <a className="btn btn-secondary" href={resolveUploadUrl(payment.proofUrl)} target="_blank" rel="noreferrer">
                View proof
              </a>
              <button className="btn btn-primary" type="button" onClick={() => void review(payment, "approve")}>
                Approve
              </button>
              <button className="btn-ghost" type="button" onClick={() => void review(payment, "reject")}>
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}