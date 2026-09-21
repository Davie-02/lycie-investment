/**
 * Page opened from the admin reset-password email (?token=…). Lets the admin choose a
 * new password, checked against the strength rules, then calls POST /api/auth/reset-
 * password.
 */
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import { checkPassword } from "@/utils/password";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { adminResetPassword } from "../adminApi";
import "../components/AdminLayout.css";

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

export default function AdminResetPassword() {
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
      await adminResetPassword(token, values.newPassword);
      setIsDone(true);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="form-card admin-login__card">
        {!token ? (
          <>
            <h1 className="admin-login__title">Invalid link</h1>
            <FormStatusBanner
              status="error"
              successMessage=""
              errorMessage="This password reset link is missing its token. Request a new one below."
            />
            <p className="text-muted admin-login__switch">
              <Link to="/admin/forgot-password">Request a new reset link</Link>
            </p>
          </>
        ) : isDone ? (
          <>
            <h1 className="admin-login__title">Password changed</h1>
            <FormStatusBanner
              status="success"
              successMessage="Your password has been reset. You can now sign in with it."
              errorMessage={null}
            />
            <div className="form-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => navigate("/admin/login")}
              >
                Go to Sign In
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="admin-login__title">Choose a new password</h1>

            {errorMessage && (
              <FormStatusBanner status="error" successMessage="" errorMessage={errorMessage} />
            )}

            <div className="form-grid">
              <NewPasswordField
                id="admin-reset-new-password"
                label="New Password"
                value={values.newPassword}
                onChange={(newPassword) => setValues((prev) => ({ ...prev, newPassword }))}
                onSuggest={(newPassword) => setValues((prev) => ({ ...prev, newPassword, confirmPassword: newPassword }))}
                error={errors.newPassword}
              />
              <FormField
                id="admin-reset-confirm-password"
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

            <p className="text-muted admin-login__switch">
              <Link to="/admin/forgot-password">Request a new reset link</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
