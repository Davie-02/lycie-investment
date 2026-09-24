/**
 * Payments: the account balance, paying by mobile money, uploading proof of
 * another payment (approved by staff) — optionally for one purchase, which it
 * then pays directly — and the history of both.
 */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import MobileMoneyCard from "@/components/customer/MobileMoneyCard";
import { submitPayment } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { formatCurrency } from "@/utils/format";
import { usePortal } from "./PortalContext";
import PortalHeading from "./PortalHeading";
import { statusTone } from "./shared";
import { money } from "@/utils/purchases";

interface PaymentFormValues {
  amount: string;
  description: string;
}

export default function Payments() {
  const { account, purchases, isLoading, reloadPurchases } = usePortal();
  const [params] = useSearchParams();
  const owing = purchases.filter((p) => p.status === "active" && Number(p.balance) > 0);
  const [purchaseId, setPurchaseId] = useState(() => {
    const wanted = params.get("purchase");
    return wanted && owing.some((p) => p.id === wanted) ? wanted : "";
  });
  const [values, setValues] = useState<PaymentFormValues>({ amount: "", description: "" });
  const [proof, setProof] = useState<File | null>(null);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [proofError, setProofError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!account) return <p className="text-muted">Your account couldn't be loaded. Please refresh the page.</p>;

  const handleChange = (field: keyof PaymentFormValues) => (e: ChangeEvent<HTMLInputElement>) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(values.amount);
    const badAmount = !values.amount.trim() || !Number.isInteger(amount) || amount <= 0;
    setAmountError(badAmount ? "Enter a whole amount greater than zero." : undefined);
    setProofError(proof ? null : "Choose an image of your proof of payment.");
    if (badAmount || !proof) return;

    setStatus("idle");
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await submitPayment(amount, proof, values.description || undefined, purchaseId || undefined);
      await reloadPurchases();
      setValues({ amount: "", description: "" });
      setProof(null);
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Unable to submit your payment.");
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PortalHeading title="Payments" intro="Your balance, ways to pay, and your payment history." />

      <div className="portal-balance">
        <div>
          <span>Available balance</span>
          <strong>{formatCurrency(Number(account.balance), account.currency)}</strong>
        </div>
      </div>

      <MobileMoneyCard />

      <form className="form-card customer-account__form" onSubmit={handleSubmit} noValidate>
        <h3 style={{ marginTop: 0 }}>Paid another way? Upload your proof</h3>
        <p className="text-muted">A bank slip or transfer screenshot. Once our team has checked it, it pays the purchase you choose — or goes to your balance.</p>
        {status === "success" && <FormStatusBanner status="success" successMessage="Payment submitted. It will count once our team approves it." errorMessage={null} />}
        {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />}
        <div className="form-grid form-grid--2col">
          <FormField id="transaction-amount" label={`Amount (${account.currency})`} type="number" min="1" step="1" required value={values.amount} onChange={handleChange("amount")} error={amountError} />
          <FormField id="transaction-description" label="Description (optional)" value={values.description} onChange={handleChange("description")} />
          {owing.length > 0 && (
            <FormField as="select" id="transaction-purchase" label="What is it for?" wrapperClassName="form-grid__full" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
              <option value="">Add it to my account balance</option>
              {owing.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference} — {p.title} (balance {money(p.balance, p.currency)})
                </option>
              ))}
            </FormField>
          )}
          <div className="form-field form-grid__full">
            <label htmlFor="payment-proof">
              Proof of payment<span className="form-field__required"> *</span>
            </label>
            <input
              id="payment-proof"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={proofError ? "form-field__input form-field__input--error" : "form-field__input"}
              onChange={(event) => setProof(event.target.files?.[0] ?? null)}
            />
            {proofError && <p className="form-field__error" role="alert">{proofError}</p>}
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </form>

      <section className="portal-card customer-account">
        <h3>Transaction history</h3>
        {account.transactions.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No transactions yet.</p>
        ) : (
          <div className="customer-account__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {account.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.createdAt).toLocaleDateString()}</td>
                    <td>{transaction.type === "DEPOSIT" ? "Money in" : "Money out"}</td>
                    <td className="mono">{transaction.reference}</td>
                    <td>{formatCurrency(Number(transaction.amount), transaction.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-card customer-account">
        <h3>Payment proofs you've sent</h3>
        {account.paymentSubmissions.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>None yet.</p>
        ) : (
          <div className="customer-account__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>For</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {account.paymentSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{new Date(submission.createdAt).toLocaleDateString()}</td>
                    <td className="mono">{submission.reference}</td>
                    <td>{purchases.find((p) => p.id === submission.purchaseId)?.reference ?? "Balance"}</td>
                    <td>{formatCurrency(Number(submission.amount), submission.currency)}</td>
                    <td>
                      <span className={`portal-pill ${statusTone(submission.status === "APPROVED" ? "confirmed" : submission.status === "REJECTED" ? "cancelled" : "")}`}>
                        {submission.status.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
