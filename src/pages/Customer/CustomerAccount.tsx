import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import {
  getCustomerAccount,
  getCustomerCases,
  getMyRequests,
  submitPayment,
  updateCustomerProfile,
  changeCustomerPassword,
  type CustomerAccount as Account,
  type CustomerCase,
  type CustomerRequestSummary,
} from "@/services/customer.service";
import { ApiError } from "@/services/http";
import { formatCurrency } from "@/utils/format";
import "./customer.css";

const REQUEST_TYPE_LABELS: Record<CustomerRequestSummary["type"], string> = {
  inquiry: "Vehicle inquiry",
  import: "Import request",
  clearing: "Clearing request",
  hire: "Hire request",
  contact: "Contact message",
};

interface ProfileFormValues {
  name: string;
  email: string;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function validateProfileForm(values: ProfileFormValues) {
  const errors: Partial<Record<keyof ProfileFormValues, string>> = {};
  if (!values.name.trim()) errors.name = "Full name is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

function validatePasswordForm(values: PasswordFormValues) {
  const errors: Partial<Record<keyof PasswordFormValues, string>> = {};
  if (!values.currentPassword) errors.currentPassword = "Enter your current password.";
  if (!values.newPassword) {
    errors.newPassword = "Enter a new password.";
  } else if (values.newPassword.length < 8) {
    errors.newPassword = "New password must be at least 8 characters.";
  }
  if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

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
  const { currentUser, logout, updateCurrentUser } = useCustomerAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [cases, setCases] = useState<CustomerCase[]>([]);
  const [requests, setRequests] = useState<CustomerRequestSummary[]>([]);
  const [values, setValues] = useState<PaymentFormValues>({ amount: "", description: "" });
  const [proof, setProof] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PaymentFormValues, string>>>({});
  const [proofError, setProofError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [profileValues, setProfileValues] = useState<ProfileFormValues>({
    name: currentUser?.name ?? "",
    email: currentUser?.email ?? "",
  });
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof ProfileFormValues, string>>>({});
  const [profileStatus, setProfileStatus] = useState<"idle" | "success" | "error">("idle");
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);

  const [passwordValues, setPasswordValues] = useState<PasswordFormValues>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof PasswordFormValues, string>>>({});
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "success" | "error">("idle");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getCustomerAccount(), getCustomerCases(), getMyRequests()])
      .then(([loadedAccount, loadedCases, loadedRequests]) => {
        setAccount(loadedAccount);
        setCases(loadedCases);
        setRequests(loadedRequests);
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

  function handleProfileChange(field: keyof ProfileFormValues) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setProfileValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateProfileForm(profileValues);
    setProfileErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setProfileStatus("idle");
    setProfileErrorMessage(null);
    setIsProfileSubmitting(true);

    try {
      const updated = await updateCustomerProfile(profileValues);
      updateCurrentUser(updated);
      setProfileStatus("success");
    } catch (error) {
      setProfileErrorMessage(error instanceof ApiError ? error.message : "Unable to update your profile.");
      setProfileStatus("error");
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  function handlePasswordChange(field: keyof PasswordFormValues) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setPasswordValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validatePasswordForm(passwordValues);
    setPasswordErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setPasswordStatus("idle");
    setPasswordErrorMessage(null);
    setIsPasswordSubmitting(true);

    try {
      await changeCustomerPassword(passwordValues.currentPassword, passwordValues.newPassword);
      setPasswordValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordStatus("success");
    } catch (error) {
      setPasswordErrorMessage(error instanceof ApiError ? error.message : "Unable to change your password.");
      setPasswordStatus("error");
    } finally {
      setIsPasswordSubmitting(false);
    }
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
              <h2>My requests</h2>
              {requests.length === 0 ? (
                <p className="text-muted">
                  Nothing here yet. Requests you submit while signed in — vehicle inquiries, hire bookings,
                  import/clearing requests, and contact messages — will show up here.
                </p>
              ) : (
                <div className="customer-account__table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((request) => (
                        <tr key={`${request.type}-${request.id}`}>
                          <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                          <td>{REQUEST_TYPE_LABELS[request.type]}</td>
                          <td>
                            {request.summary}
                            {request.hireDetails && (
                              <>
                                {" "}
                                <span className="text-muted">
                                  ({new Date(request.hireDetails.pickupDate).toLocaleDateString()} →{" "}
                                  {new Date(request.hireDetails.returnDate).toLocaleDateString()},{" "}
                                  {request.hireDetails.days} day{request.hireDetails.days === 1 ? "" : "s"},{" "}
                                  {formatCurrency(request.hireDetails.totalCost, request.hireDetails.currency)})
                                </span>
                              </>
                            )}
                          </td>
                          <td>{request.status.replace("_", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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

            <div className="customer-account__history customer-account__settings">
              <h2>Profile settings</h2>
              <form className="form-card customer-account__form" onSubmit={handleProfileSubmit} noValidate>
                {profileStatus === "success" && (
                  <FormStatusBanner status="success" successMessage="Profile updated." errorMessage={null} />
                )}
                {profileStatus === "error" && (
                  <FormStatusBanner status="error" successMessage="" errorMessage={profileErrorMessage} />
                )}

                <div className="form-grid form-grid--2col">
                  <FormField
                    id="profile-name"
                    label="Full Name"
                    required
                    value={profileValues.name}
                    onChange={handleProfileChange("name")}
                    error={profileErrors.name}
                    autoComplete="name"
                  />
                  <FormField
                    id="profile-email"
                    label="Email"
                    type="email"
                    required
                    value={profileValues.email}
                    onChange={handleProfileChange("email")}
                    error={profileErrors.email}
                    autoComplete="username"
                  />
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={isProfileSubmitting}>
                    {isProfileSubmitting ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>

            <div className="customer-account__history customer-account__settings">
              <h2>Change password</h2>
              <form className="form-card customer-account__form" onSubmit={handlePasswordSubmit} noValidate>
                {passwordStatus === "success" && (
                  <FormStatusBanner
                    status="success"
                    successMessage="Password changed."
                    errorMessage={null}
                  />
                )}
                {passwordStatus === "error" && (
                  <FormStatusBanner status="error" successMessage="" errorMessage={passwordErrorMessage} />
                )}

                <div className="form-grid form-grid--2col">
                  <FormField
                    id="current-password"
                    label="Current Password"
                    type="password"
                    required
                    value={passwordValues.currentPassword}
                    onChange={handlePasswordChange("currentPassword")}
                    error={passwordErrors.currentPassword}
                    autoComplete="current-password"
                    wrapperClassName="form-grid__full"
                  />
                  <FormField
                    id="new-password"
                    label="New Password"
                    type="password"
                    required
                    value={passwordValues.newPassword}
                    onChange={handlePasswordChange("newPassword")}
                    error={passwordErrors.newPassword}
                    autoComplete="new-password"
                  />
                  <FormField
                    id="confirm-password"
                    label="Confirm New Password"
                    type="password"
                    required
                    value={passwordValues.confirmPassword}
                    onChange={handlePasswordChange("confirmPassword")}
                    error={passwordErrors.confirmPassword}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={isPasswordSubmitting}>
                    {isPasswordSubmitting ? "Saving…" : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </section>
    </>
  );
}
