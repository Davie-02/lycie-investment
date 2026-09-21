/**
 * 'Forgot your password?' page: asks for an email and calls POST /api/customers/forgot-
 * password. It always shows the same 'check your email' message, so it can't be used to
 * discover which emails have accounts.
 */
import { useState, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import Seo from "@/components/common/Seo";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { emailError } from "@/utils/email";
import { forgotPassword } from "@/services/customer.service";
import { ApiError } from "@/services/http";
import "./customer.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = emailError(email);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      // Always shows the same success state regardless of whether the
      // email matched an account — the backend never reveals that either,
      // so this page can't be used to check which emails have accounts.
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Seo title="Forgot Password" description="Reset your Lycie Investments customer account password." />
      <section className="service-hero">
        <div className="container">
          <h1>Forgot your password?</h1>
          <p>Enter your email and we'll send you a link to reset it.</p>
        </div>
      </section>
      <section className="section container customer-auth">
        <div className="form-card customer-auth__form">
          {isSubmitted ? (
            <>
              <h2>Check your email</h2>
              <FormStatusBanner
                status="success"
                successMessage="If that email is registered, a reset link is on its way. It expires in 1 hour."
                errorMessage={null}
              />
              <p className="text-muted customer-auth__switch">
                <Link to="/account/login">Back to sign in</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h2>Reset your password</h2>

              {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

              <div className="form-grid">
                <FormField
                  id="forgot-password-email"
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

              <p className="text-muted customer-auth__switch">
                <Link to="/account/login">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
