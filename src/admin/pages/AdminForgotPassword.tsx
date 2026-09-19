import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { adminForgotPassword } from "../adminApi";
import "../components/AdminLayout.css";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await adminForgotPassword(email);
      // Always shows the same success state regardless of whether the
      // email matched an admin account — the backend never reveals that
      // either, so this page can't be used to enumerate admin accounts.
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="form-card admin-login__card">
        {isSubmitted ? (
          <>
            <h1 className="admin-login__title">Check your email</h1>
            <FormStatusBanner
              status="success"
              successMessage="If that email is registered, a reset link is on its way. It expires in 1 hour."
              errorMessage={null}
            />
            <p className="text-muted admin-login__switch">
              <Link to="/admin/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h1 className="admin-login__title">Forgot your password?</h1>
            <p className="text-muted admin-login__subtitle">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>

            {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

            <div className="form-grid">
              <FormField
                id="admin-forgot-password-email"
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send Reset Link"}
              </button>
            </div>

            <p className="text-muted admin-login__switch">
              <Link to="/admin/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
