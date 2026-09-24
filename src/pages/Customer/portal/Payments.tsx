/**
 * Payments: the account balance, "Make a payment" (choose what for, then how:
 * mobile money, the balance, or proof of a bank/cash payment — see PaymentFlow),
 * and the history of money in and out, mobile-money attempts and proofs sent.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getMyMobilePayments, type MobilePaymentView } from "@/services/customer.service";
import { formatCurrency } from "@/utils/format";
import { usePortal } from "./PortalContext";
import PortalHeading from "./PortalHeading";
import PaymentFlow from "./PaymentFlow";
import { statusTone } from "./shared";

const MOBILE_STATUS: Record<string, string> = { success: "Paid", pending: "Waiting", failed: "Didn't go through" };

export default function Payments() {
  const { account, purchases, isLoading } = usePortal();
  const [params] = useSearchParams();
  const [mobile, setMobile] = useState<Array<MobilePaymentView & { note: string; createdAt: string }>>([]);

  useEffect(() => {
    getMyMobilePayments()
      .then(setMobile)
      .catch(() => setMobile([]));
  }, [account?.balance]);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!account) return <p className="text-muted">Your account couldn't be loaded. Please refresh the page.</p>;

  return (
    <>
      <PortalHeading title="Payments" intro="Pay for a purchase or booking, make a deposit, and see your payment history." />

      <div className="portal-balance">
        <div>
          <span>Available balance</span>
          <strong>{formatCurrency(Number(account.balance), account.currency)}</strong>
        </div>
      </div>

      <PaymentFlow preselect={params.get("purchase")} />

      {mobile.length > 0 && (
        <section className="portal-card customer-account">
          <h3>Mobile money payments</h3>
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
                {mobile.slice(0, 10).map((payment) => (
                  <tr key={payment.txRef}>
                    <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
                    <td className="mono">{payment.txRef}</td>
                    <td>{payment.note || "Deposit"}</td>
                    <td>{formatCurrency(payment.amount, payment.currency)}</td>
                    <td>
                      <span className={`portal-pill ${statusTone(payment.status === "success" ? "confirmed" : payment.status === "failed" ? "cancelled" : "")}`}>{MOBILE_STATUS[payment.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                      {submission.reviewNote && <div className="text-muted">{submission.reviewNote}</div>}
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
