import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  getCustomerAccount,
  getCustomerCases,
  submitPayment,
  type CustomerAccount as Account,
  type CustomerCase,
} from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { formatCurrency } from "@/utils/format";
import "./customer.css";

export default function CustomerAccount() {
  const { currentUser, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [cases, setCases] = useState<CustomerCase[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCustomerAccount(), getCustomerCases()])
      .then(([loadedAccount, loadedCases]) => {
        setAccount(loadedAccount);
        setCases(loadedCases);
      })
      .catch((error: unknown) =>
        setErrorMessage(error instanceof ApiError ? error.message : "Unable to load your account.")
      )
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const value = Number(amount);
      if (!Number.isInteger(value) || value <= 0) {
        setErrorMessage("Enter a whole amount greater than zero.");
        return;
      }
      if (!proof) {
        setErrorMessage("Choose an image of your proof of payment.");
        return;
      }
      await submitPayment(value, proof, description || undefined);
      setAccount(await getCustomerAccount());
      setAmount("");
      setDescription("");
      setProof(null);
      setMessage("Payment submitted. Your balance will update after staff approval.");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Unable to save the transaction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/account/login");
  }

  return (
    <>
      <Seo title="My Account" description="View your Lycie Investment account and transaction history." />
      <section className="service-hero">
        <div className="container customer-account__heading">
          <div>
            <h1>My account</h1>
            <p>Welcome back, {currentUser?.name}.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={handleLogout}>Log out</button>
        </div>
      </section>
      <section className="section container customer-account">
        {isLoading && <p>Loading your account...</p>}
        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}
        {account && !isLoading && (
          <>
            <div className="customer-account__summary">
              <span className="text-muted">Available balance</span>
              <strong>{formatCurrency(Number(account.balance), account.currency)}</strong>
            </div>
            <form className="form-card customer-account__form" onSubmit={handleSubmit}>
              <h2>Submit payment</h2>
              {message && (
                <p className="form-success" role="status">
                  {message}
                </p>
              )}
              <label htmlFor="transaction-amount">Amount ({account.currency})</label>
              <input
                id="transaction-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              <label htmlFor="transaction-description">Description (optional)</label>
              <input
                id="transaction-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <label htmlFor="payment-proof">Proof of payment</label>
              <input
                id="payment-proof"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setProof(event.target.files?.[0] ?? null)}
                required
              />
              <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit for review"}
              </button>
            </form>
            <div className="customer-account__history">
              <h2>Vehicle updates</h2>
              {cases.length === 0 ? (
                <p className="text-muted">No vehicle updates have been added to your account.</p>
              ) : (
                <div className="customer-cases">
                  {cases.map((customerCase) => (
                    <article className="customer-case" key={customerCase.id}>
                      <div className="customer-case__heading">
                        <div>
                          <h3>{customerCase.title}</h3>
                          <p className="text-muted">
                            {customerCase.vehicle
                              ? `${customerCase.vehicle.make} ${customerCase.vehicle.model} (${customerCase.vehicle.year})`
                              : customerCase.hireVehicle?.name}
                          </p>
                        </div>
                        <strong>{customerCase.status.replace("_", " ")}</strong>
                      </div>
                      {customerCase.details && <p>{customerCase.details}</p>}
                      <ul>
                        {customerCase.updates.map((update) => (
                          <li key={update.id}>
                            <span className="mono">{new Date(update.createdAt).toLocaleDateString()}</span>{" "}
                            {update.message}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              )}
            </div>
            <div className="customer-account__history">
              <h2>Transaction history</h2>
              {account.transactions.length === 0 ? (
                <p className="text-muted">No transactions yet.</p>
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
                          <td>{transaction.type}</td>
                          <td className="mono">{transaction.reference}</td>
                          <td>
                            {formatCurrency(Number(transaction.amount), transaction.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="customer-account__history">
              <h2>Payment submissions</h2>
              {account.paymentSubmissions.length === 0 ? (
                <p className="text-muted">No payment submissions yet.</p>
              ) : (
                <div className="customer-account__table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {account.paymentSubmissions.map((submission) => (
                        <tr key={submission.id}>
                          <td>{new Date(submission.createdAt).toLocaleDateString()}</td>
                          <td className="mono">{submission.reference}</td>
                          <td>{formatCurrency(Number(submission.amount), submission.currency)}</td>
                          <td>{submission.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}