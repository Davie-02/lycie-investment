import { useEffect, useState } from "react";
import { adminApi, resolveUploadUrl } from "../adminApi";

interface PaymentSubmission {
  id: string;
  amount: string;
  currency: string;
  proofUrl: string;
  reference: string;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  customer: { name: string; email: string };
  createdAt: string;
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

  async function review(paymentId: string, action: "approve" | "reject") {
    const note = window.prompt(action === "approve" ? "Optional approval note" : "Reason for rejection");
    if (action === "reject" && !note?.trim()) return;

    try {
      await adminApi.post(`/financial/payments/${paymentId}/${action}`, { note: note?.trim() || undefined });
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
            </div>
            <div className="admin-list__actions">
              <a className="btn btn-secondary" href={resolveUploadUrl(payment.proofUrl)} target="_blank" rel="noreferrer">
                View proof
              </a>
              <button className="btn btn-primary" type="button" onClick={() => void review(payment.id, "approve")}>
                Approve
              </button>
              <button className="btn-ghost" type="button" onClick={() => void review(payment.id, "reject")}>
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}