/**
 * Finance → Payment proofs. Customers upload proof of a bank/cash payment and say
 * what it's for: a purchase (or hire booking), or a described deposit. Staff check
 * the proof, confirm the amount that ACTUALLY arrived (the customer's figure is kept
 * in the note if it differs), and approve or reject.
 *
 * For a purchase, the proof is compared with what's still owed: only that much goes
 * on the purchase; anything extra goes to the customer's account balance and they
 * are told. A deposit goes to the balance. Every rule here is enforced by the server.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import { money } from "@/utils/purchases";
import { adminApi, resolveUploadUrl } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import "../components/AdminLayout.css";
import "./purchases/purchases.css";

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
  const { can } = useAdminAuth();
  const canEdit = can("finance", "edit");
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

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

  return (
    <section>
      <div className="ws-hero">
        <div>
          <h1>Payment proofs</h1>
          <p>Check each proof against your bank or cash records before approving. Nothing changes until you approve.</p>
        </div>
      </div>

      {errorMessage && <p className="form-status form-status--error" role="alert">{errorMessage}</p>}
      {notice && <p className="form-status form-status--success" role="status">{notice}</p>}
      {isLoading && <p className="text-muted">Loading…</p>}
      {!isLoading && payments.length === 0 && <p className="admin-empty-state">No payments are waiting for review.</p>}

      <div className="proof-list">
        {payments.map((payment) => (
          <article className="form-card proof-card" key={payment.id}>
            <div className="proof-card__head">
              <div>
                <h2 className="purchase-detail__h">
                  <Link to={`/admin/customer-accounts/${payment.customer.id}`}>{payment.customer.name}</Link>
                </h2>
                <p className="text-muted" style={{ margin: 0 }}>
                  {payment.customer.email} · sent {new Date(payment.createdAt).toLocaleString()} · <span className="mono">{payment.reference}</span>
                </p>
              </div>
              <a className="btn btn-secondary" href={resolveUploadUrl(payment.proofUrl)} target="_blank" rel="noreferrer">
                View proof
              </a>
            </div>

            <dl className="purchase-form__totals">
              <div>
                <dt>They say they paid</dt>
                <dd>
                  <strong>{money(payment.amount, payment.currency)}</strong>
                </dd>
              </div>
              <div>
                <dt>For</dt>
                <dd>
                  {payment.purchase ? (
                    <Link to={`/admin/purchases/${payment.purchase.id}`}>
                      {payment.purchase.reference} — {payment.purchase.title}
                    </Link>
                  ) : (
                    "Deposit to their account balance"
                  )}
                </dd>
              </div>
              {payment.purchase && (
                <div>
                  <dt>Still owed on it</dt>
                  <dd>{money(Number(payment.purchase.total) - Number(payment.purchase.amountPaid), payment.purchase.currency)}</dd>
                </div>
              )}
            </dl>
            {payment.note && <p style={{ margin: 0 }}>“{payment.note}”</p>}

            {canEdit && open?.id !== payment.id && (
              <div className="admin-table__actions">
                <button className="btn btn-primary" type="button" onClick={() => setOpen({ id: payment.id, action: "approve" })}>
                  Approve…
                </button>
                <button className="btn-ghost" type="button" onClick={() => setOpen({ id: payment.id, action: "reject" })}>
                  Reject…
                </button>
              </div>
            )}
            {open?.id === payment.id && (
              <ReviewForm
                payment={payment}
                action={open.action}
                onCancel={() => setOpen(null)}
                onDone={(message) => {
                  setOpen(null);
                  setNotice(message);
                  setPayments((current) => current.filter((p) => p.id !== payment.id));
                }}
              />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ReviewForm({ payment, action, onCancel, onDone }: { payment: PaymentSubmission; action: "approve" | "reject"; onCancel: () => void; onDone: (message: string) => void }) {
  const purchase = payment.purchase;
  const foreign = Boolean(purchase && purchase.currency !== payment.currency);
  const [received, setReceived] = useState(String(Number(payment.amount)));
  const [rate, setRate] = useState<number | null>(null);
  const [credit, setCredit] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Today's rate, to suggest what a kwacha proof is worth in the purchase's currency.
  useEffect(() => {
    if (!purchase || !foreign) return;
    adminApi
      .get<{ rate: string | null }>(`/purchases/rate?from=${purchase.currency}&to=${payment.currency}`)
      .then((r) => setRate(r.rate ? Number(r.rate) : null))
      .catch(() => setRate(null));
  }, [purchase, foreign, payment.currency]);

  const receivedNum = Number(received) || 0;
  const creditNum = foreign ? Number(credit) || (rate ? Math.round((receivedNum / rate) * 100) / 100 : 0) : receivedNum;
  const owed = purchase ? Math.max(0, Number(purchase.total) - Number(purchase.amountPaid)) : 0;
  const extra = purchase && creditNum > owed ? Math.round((creditNum - owed) * 100) / 100 : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (action === "reject" && note.trim().length < 3) return setError("Say why it's rejected (the customer is told).");
    if (action === "approve" && !(receivedNum > 0)) return setError("Enter the amount that actually arrived.");
    if (action === "approve" && foreign && !(creditNum > 0)) return setError(`Enter what it's worth in ${purchase!.currency}.`);
    setBusy(true);
    try {
      await adminApi.post(`/financial/payments/${payment.id}/${action}`, {
        note: note.trim() || undefined,
        receivedAmount: action === "approve" && receivedNum !== Number(payment.amount) ? receivedNum : undefined,
        // Only when typed: otherwise the server converts at its own (exact) rate.
        creditAmount: action === "approve" && foreign && Number(credit) > 0 ? Number(credit) : undefined,
      });
      onDone(
        action === "reject"
          ? "Rejected."
          : extra > 0
            ? `Approved. ${money(owed, purchase!.currency)} paid the purchase; the extra ${money(extra, purchase!.currency)} went to the customer's balance and they've been told.`
            : "Approved."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. It may already have been reviewed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="proof-review" onSubmit={submit} noValidate>
      {action === "approve" && (
        <div className="form-grid form-grid--2col">
          <FormField id={`rcv-${payment.id}`} label={`Amount that actually arrived (${payment.currency})`} type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} />
          {foreign && (
            <FormField
              id={`cr-${payment.id}`}
              label={`Worth in ${purchase!.currency}`}
              type="number"
              min="0"
              step="0.01"
              value={credit}
              placeholder={rate ? String(Math.round((receivedNum / rate) * 100) / 100) : ""}
              onChange={(e) => setCredit(e.target.value)}
              footer={<p className="text-muted purchase-pay__hint">{rate ? `Today's rate: ${rate.toLocaleString()} ${payment.currency} per ${purchase!.currency} 1. Leave empty to use it.` : "No rate known — enter the amount."}</p>}
            />
          )}
        </div>
      )}
      {action === "approve" && receivedNum !== Number(payment.amount) && receivedNum > 0 && (
        <p className="pay-note">The customer said {money(payment.amount, payment.currency)}; you're approving {money(receivedNum, payment.currency)}. Both figures are kept.</p>
      )}
      {action === "approve" && purchase && creditNum > 0 && (
        <p className={extra > 0 ? "pay-note pay-note--warn" : "pay-note"}>
          {extra > 0
            ? `This is ${money(extra, purchase.currency)} more than is owed. ${money(owed, purchase.currency)} will pay the purchase and the extra goes to the customer's account balance (they'll be told).`
            : creditNum === owed
              ? "This pays the purchase in full."
              : `This pays part of it; ${money(owed - creditNum, purchase.currency)} will still be owed.`}
        </p>
      )}
      <FormField id={`note-${payment.id}`} label={action === "approve" ? "Note (optional)" : "Reason (the customer sees it)"} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : action === "approve" ? "Approve" : "Reject"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
