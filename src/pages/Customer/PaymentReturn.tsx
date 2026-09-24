/**
 * Where PayChangu sends customers back after paying. The page asks our server
 * to confirm with the gateway (the address itself proves nothing), then shows
 * the outcome. Waiting payments are checked again a few times.
 */
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmMobilePayment, type MobilePaymentView } from "@/services/customer.service";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const txRef = params.get("tx_ref") ?? "";
  const { isAuthenticated } = useCustomerAuth();
  const [payment, setPayment] = useState<MobilePaymentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txRef || !isAuthenticated) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      confirmMobilePayment(txRef)
        .then((result) => {
          setPayment(result);
          if (result.status === "pending" && ++tries < 6) timer = setTimeout(check, 5000);
        })
        .catch((err: Error) => setError(err.message));
    };
    check();
    return () => clearTimeout(timer);
  }, [txRef, isAuthenticated]);

  return (
    <section className="section container" style={{ maxWidth: 640 }}>
      <div className="form-card">
        <h1 style={{ marginTop: 0 }}>Payment</h1>
        {!isAuthenticated && <p>Please <Link to="/account/login">sign in</Link> to see your payment.</p>}
        {error && <p className="form-status form-status--error" role="alert">{error}</p>}
        {isAuthenticated && !payment && !error && <p className="text-muted">Checking your payment with the mobile money provider…</p>}
        {payment?.status === "success" && (
          <p className="form-status form-status--success" role="status">
            Thank you! We received MWK {payment.amount.toLocaleString()}. It's now in your account (reference {payment.txRef}).
          </p>
        )}
        {payment?.status === "pending" && (
          <p className="form-status form-status--info" role="status">
            We're still waiting for confirmation from your mobile money provider. Approve the prompt on your phone if you haven't — this page checks again automatically.
          </p>
        )}
        {payment?.status === "failed" && (
          <p className="form-status form-status--error" role="alert">
            The payment didn't go through, and nothing was taken from your wallet. You can try again from your account.
          </p>
        )}
        <Link className="btn btn-secondary" to="/account/payments">
          Back to my payments
        </Link>
      </div>
    </section>
  );
}
