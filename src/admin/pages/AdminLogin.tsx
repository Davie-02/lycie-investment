import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { emailError } from "@/utils/email";
import { checkPassword } from "@/utils/password";
import { offerToSavePassword } from "@/utils/credentials";
import "../components/AdminLayout.css";

const REASON_MESSAGES: Record<string, string> = {
  inactivity: "You were logged out after a period of inactivity. Please log in again.",
  expired: "Your session has expired. Please log in again.",
};

/**
 * The SYSTEM ADMINISTRATOR PORTAL — sign-in for Owner accounts only (other
 * staff sign in on the website's normal sign-in page and are sent to the
 * workspace). Steps: email + password → [choose your own password, if invited]
 * → authenticator code → signed in. No "keep me signed in" here: administrator
 * sessions are always short, and two-step verification is mandatory.
 */
export default function AdminLogin() {
  const { isAuthenticated, isLoggingIn, loginError, needsTwoFactor, needsPasswordChange, login, submitTwoFactor, submitFirstPassword, cancelTwoFactor } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
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

    if (await login(email, password, false)) {
      // Ask the browser to offer to save the password (see utils/credentials.ts).
      void offerToSavePassword(email, password);
      navigate("/admin");
    }
  }

  async function handleNewPassword(e: FormEvent) {
    e.preventDefault();
    if (!checkPassword(newPassword, [needsPasswordChange?.name, email]).acceptable) {
      setLocalError("Your new password doesn't meet all the requirements listed under it.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("The two passwords don't match.");
      return;
    }
    setLocalError(null);
    if (await submitFirstPassword(newPassword)) {
      void offerToSavePassword(email, newPassword);
      navigate("/admin/security");
    }
  }

  async function handleCodeStep(e: FormEvent) {
    e.preventDefault();
    if (await submitTwoFactor(code)) navigate("/admin");
  }

  return (
    <div className="admin-login">
      {needsPasswordChange ? (
        <form className="form-card admin-login__card" onSubmit={handleNewPassword} noValidate name="admin-first-password">
          <h1 className="admin-login__title">Choose your password</h1>
          <p className="text-muted admin-login__subtitle">Welcome, {needsPasswordChange.name}. Replace the one-time password from your invitation with your own.</p>
          {(localError || loginError) && <FormStatusBanner status="error" successMessage="" errorMessage={localError ?? loginError} />}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <div className="form-grid">
            <NewPasswordField
              id="admin-new-password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              onSuggest={(suggested) => {
                setNewPassword(suggested);
                setConfirmPassword(suggested);
              }}
              personalData={[needsPasswordChange.name, email]}
            />
            <FormField id="admin-new-password-confirm" label="Confirm new password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
              {isLoggingIn ? "Saving…" : "Set password"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelTwoFactor}>
              Back
            </button>
          </div>
        </form>
      ) : needsTwoFactor ? (
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
          <h1 className="admin-login__title">System administrator portal</h1>
          <p className="text-muted admin-login__subtitle">For Lycie Investments system administrators only. Every sign-in is logged and emailed to the account owner.</p>

          {reasonMessage && !loginError && <FormStatusBanner status="error" successMessage="" errorMessage={reasonMessage} />}
          {loginError && <FormStatusBanner status="error" successMessage="" errorMessage={loginError} />}

          <div className="form-grid">
            <EmailField id="email" name="email" verify={false} value={email} onChange={setEmail} error={emailProblem} autoComplete="username" />
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
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in…" : "Sign In"}
            </button>
          </div>

          <p className="text-muted admin-login__switch">
            <Link to="/admin/forgot-password">Forgot your password?</Link>
          </p>
          <p className="text-muted admin-login__switch">
            Staff member? <Link to="/account/login">Sign in on the main sign-in page</Link>.
          </p>
        </form>
      )}
    </div>
  );
}
