/**
 * "Pay with mobile money" on the customer account page: Airtel Money or TNM
 * Mpamba through PayChangu's secure page. Hidden until the company switches
 * mobile money on. Paid amounts are credited to the account automatically.
 */
import { useEffect, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { getMyMobilePayments, mobileMoneyEnabled, startMobilePayment, type MobilePaymentView } from "@/services/customer.service";

const PURPOSES = [
  { key: "deposit", label: "Account deposit" },
  { key: "hire", label: "Vehicle hire" },
  { key: "import", label: "Vehicle import" },
  { key: "clearing", label: "Clearing" },
  { key: "other", label: "Something else" },
];
const STATUS: Record<string, string> = { success: "Paid", pending: "Waiting", failed: "Didn't go through" };

export default function MobileMoneyCard() {
  const [enabled, setEnabled] = useState(false);
  const [payments, setPayments] = useState<Array<MobilePaymentView & { note: string; createdAt: string }>>([]);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("deposit");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void mobileMoneyEnabled().then((on) => {
      setEnabled(on);
      if (on) getMyMobilePayments().then(setPayments).catch(() => undefined);
    });
  }, []);

  if (!enabled) return null;

  async function pay(event: FormEvent) {
    event.preventDefault();
    const value = Math.round(Number(amount.replace(/[^\d.]/g, "")));
    if (!value || value < 100) {
      setError("Enter an amount of at least MWK 100.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await startMobilePayment(value, purpose, note || undefined);
      // Only ever PayChangu's own secure page.
      if (!/^https:\/\/([\w-]+\.)*paychangu\.com\//.test(checkoutUrl)) throw new Error("Unexpected payment address.");
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the payment.");
      setBusy(false);
    }
  }

  return (
    <div className="customer-account__history">
      <h2>Pay with mobile money</h2>
      <p className="text-muted">Pay with Airtel Money or TNM Mpamba on a secure page. The amount appears in your account as soon as it's confirmed.</p>
      <form className="form-card customer-account__form" onSubmit={pay} noValidate>
        {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}
        <div className="form-grid form-grid--2col">
          <FormField id="mm-amount" label="Amount (MWK)" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 50000" />
          <FormField as="select" id="mm-purpose" label="What for" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            {PURPOSES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </FormField>
          <FormField id="mm-note" label="Reference (optional)" wrapperClassName="form-grid__full" placeholder="e.g. booking for the Toyota Hilux" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Opening secure payment…" : "Continue to payment"}
          </button>
        </div>
      </form>
      {payments.length > 0 && (
        <ul className="customer-alerts">
          {payments.slice(0, 5).map((payment) => (
            <li key={payment.txRef} className="customer-alert">
              <div>
                <strong>MWK {payment.amount.toLocaleString()}</strong>
                <span className="text-muted">
                  {new Date(payment.createdAt).toLocaleDateString()} · {payment.txRef}
                </span>
              </div>
              <span>{STATUS[payment.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
