import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
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

interface PaymentFormValues {
  amount: string;
  description: string;
}

function validatePaymentForm(values: PaymentFormValues, proof: File | null) {
  const errors: Partial<Record<keyof PaymentFormValues, string>> = {};
  const numericAmount = Number(values.amount);
  if (!values.amount.trim() || !Number.isInteger(numericAmount) || numericAmount <= 0) {
    errors.amount = "Enter a whole amount greater than zero.";
  }
  return { errors, proofError: proof ? null : "Choose an image of your proof of payment." };
}

export default function CustomerAccount() {
  const { currentUser, logout } = useCustomerAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [cases, setCases] = useState<CustomerCase[]>([]);
  const [values, setValues] = useState<PaymentFormValues>({ amount: "", description: "" });
  const [proof, setProof] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PaymentFormValues, string>>>({});
  const [proofError, setProofError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCustomerAccount(), getCustomerCases()])
      .then(([loadedAccount, loadedCases]) => {
        setAccount(loadedAccount);
        setCases(loadedCases);
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Unable to load your account.")
      )
      .finally(() => setIsLoading(false));
  }, []);

  function handleChange(field: keyof PaymentFormValues) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const { errors, proofError: proofValidationError } = validatePaymentForm(values, proof);
    setFieldErrors(errors);
    setProofError(proofValidationError);
    if (Object.keys(errors).length > 0 || proofValidationError) return;

    setStatus("idle");
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await submitPayment(Number(values.amount), proof as File, values.description || undefined);
      setAccount(await getCustomerAccount());
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
        {isLoading && <p className="text-muted">Loading your account…</p>}
        {loadError && (
          <p className="text-muted" role="alert">{loadError}</p>
        )}
        {account && !isLoading && (
          <>
            <div className="customer-account__summary">
              <span className="text-muted">Available balance</span>
              <strong>{formatCurrency(Number(account.balance), account.currency)}</strong>
            </div>

            <form className="form-card customer-account__form" onSubmit={handleSubmit} noValidate>
              <h2>Submit payment</h2>

              {status === "success" && (
                <FormStatusBanner
                  status="success"
                  successMessage="Payment submitted. Your balance will update after staff approval."
                  errorMessage={null}
                />
              )}
              {status === "error" && (
                <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
              )}

              <div className="form-grid form-grid--2col">
                <FormField
                  id="transaction-amount"
                  label={`Amount (${account.currency})`}
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={values.amount}
                  onChange={handleChange("amount")}
                  error={fieldErrors.amount}
                />
                <FormField
                  id="transaction-description"
                  label="Description (optional)"
                  value={values.description}
                  onChange={handleChange("description")}
                />
                <div className="form-field form-grid__full">
                  <label htmlFor="payment-proof">
                    Proof of Payment<span className="form-field__required"> *</span>
                  </label>
                  <input
                    id="payment-proof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={proofError ? "form-field__input form-field__input--error" : "form-field__input"}
                    onChange={(event) => setProof(event.target.files?.[0] ?? null)}
                  />
                  {proofError && (
                    <p className="form-field__error" role="alert">{proofError}</p>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting…" : "Submit for Review"}
                </button>
              </div>
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
