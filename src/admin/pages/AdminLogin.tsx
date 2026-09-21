import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import RememberMe from "@/components/forms/RememberMe";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { emailError } from "@/utils/email";
import { offerToSavePassword } from "@/utils/credentials";
import "../components/AdminLayout.css";

const REASON_MESSAGES: Record<string, string> = {
  inactivity: "You were logged out after a period of inactivity. Please log in again.",
  expired: "Your session has expired. Please log in again.",
};

/**
 * Admin sign-in. Two steps when the account has two-factor switched on:
 *  1. email + password  → the server replies "code needed" (no session yet)
 *  2. the 6-digit authenticator code (or a one-time recovery code) → signed in.
 */
export default function AdminLogin() {
  const { isAuthenticated, isLoggingIn, loginError, needsTwoFactor, login, submitTwoFactor, cancelTwoFactor } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [emailProblem, setEmailProblem] = useState<string | undefined>();

  const reason = (location.state as { reason?: string } | null)?.reason;
  const reasonMessage = reason ? REASON_MESSAGES[reason] : null;

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  async function handlePasswordStep(e: FormEvent) {
    e.preventDefault();
    const problem = emailError(email);
    setEmailProblem(problem ?? undefined);
    if (problem) return;

    if (await login(email, password, remember)) {
      // Ask the browser to offer to save the password (see utils/credentials.ts).
      void offerToSavePassword(email, password);
      navigate("/admin");
    }
  }

  async function handleCodeStep(e: FormEvent) {
    e.preventDefault();
    if (await submitTwoFactor(code)) navigate("/admin");
  }

  return (
    <div className="admin-login">
      {needsTwoFactor ? (
        <form className="form-card admin-login__card" onSubmit={handleCodeStep} noValidate name="admin-2fa">
          <h1 className="admin-login__title">Two-step verification</h1>
          <p className="text-muted admin-login__subtitle">
            Enter the 6-digit code from your authenticator app, or one of your recovery codes.
          </p>

          {loginError && <FormStatusBanner status="error" successMessage="" errorMessage={loginError} />}

          <div className="form-grid">
            <FormField
              id="admin-code"
              name="one-time-code"
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoggingIn || !code.trim()}>
              {isLoggingIn ? "Checking…" : "Verify"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelTwoFactor}>
              Back
            </button>
          </div>
        </form>
      ) : (
        <form className="form-card admin-login__card" onSubmit={handlePasswordStep} noValidate name="admin-login">
          <h1 className="admin-login__title">Admin Login</h1>
          <p className="text-muted admin-login__subtitle">Lycie Investments content management</p>

          {reasonMessage && !loginError && <FormStatusBanner status="error" successMessage="" errorMessage={reasonMessage} />}
          {loginError && <FormStatusBanner status="error" successMessage="" errorMessage={loginError} />}

          <div className="form-grid">
            <EmailField id="email" name="email" value={email} onChange={setEmail} error={emailProblem} autoComplete="username" />
            <FormField
              id="password"
              name="password"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <RememberMe id="admin-remember" checked={remember} onChange={setRemember} label="Keep me signed in (only on your own device)" />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in…" : "Sign In"}
            </button>
          </div>

          <p className="text-muted admin-login__switch">
            <Link to="/admin/forgot-password">Forgot your password?</Link>
          </p>
        </form>
      )}
    </div>
  );
}
