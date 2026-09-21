/**
 * Page opened from the customer reset-password email (?token=…). Lets the customer
 * choose a new password (strength meter, suggestion and show/hide included), then calls
 * POST /api/customers/reset-password. A reset also unlocks the account and signs out
 * other devices.
 */
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import { checkPassword } from "@/utils/password";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { resetPassword } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import "./customer.css";

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

function validate(values: FormValues) {
  const errors: Partial<Record<keyof FormValues, string>> = {};
  if (!values.newPassword) {
    errors.newPassword = "Enter a new password.";
  } else if (!checkPassword(values.newPassword).acceptable) {
    errors.newPassword = "Your password doesn't meet all the requirements below.";
  }
  if (values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }
  return errors;
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [values, setValues] = useState<FormValues>({ newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  function handleChange(field: keyof FormValues) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;

    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await resetPassword(token, values.newPassword);
      setIsDone(true);
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Seo noindex title="Reset Password" description="Choose a new password for your Lycie Investments account." />
      <section className="service-hero">
        <div className="container">
          <h1>Choose a new password</h1>
        </div>
      </section>
      <section className="section container customer-auth">
        <div className="form-card customer-auth__form">
          {!token ? (
            <>
              <h2>Invalid link</h2>
              <FormStatusBanner
                status="error"
                successMessage=""
                errorMessage="This password reset link is missing its token. Request a new one below."
              />
              <p className="text-muted customer-auth__switch">
                <Link to="/account/forgot-password">Request a new reset link</Link>
              </p>
            </>
          ) : isDone ? (
            <>
              <h2>Password changed</h2>
              <FormStatusBanner
                status="success"
                successMessage="Your password has been reset. You can now sign in with it."
                errorMessage={null}
              />
              <div className="form-actions">
                <button className="btn btn-primary" type="button" onClick={() => navigate("/account/login")}>
                  Go to Sign In
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2>Choose a new password</h2>

              {errorMessage && (
                <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
              )}

              <div className="form-grid">
                <NewPasswordField
                  id="reset-new-password"
                  label="New Password"
                  value={values.newPassword}
                  onChange={(newPassword) => setValues((prev) => ({ ...prev, newPassword }))}
                  onSuggest={(newPassword) => setValues((prev) => ({ ...prev, newPassword, confirmPassword: newPassword }))}
                  error={errors.newPassword}
                />
                <FormField
                  id="reset-confirm-password"
                  name="confirm-password"
                  label="Confirm New Password"
                  type="password"
                  required
                  value={values.confirmPassword}
                  onChange={handleChange("confirmPassword")}
                  error={errors.confirmPassword}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-actions">
                <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving…" : "Reset Password"}
                </button>
              </div>

              <p className="text-muted customer-auth__switch">
                <Link to="/account/forgot-password">Request a new reset link</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
