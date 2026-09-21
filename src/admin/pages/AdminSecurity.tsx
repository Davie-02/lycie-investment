import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import FormField from "@/components/forms/FormField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { checkPassword } from "@/utils/password";
import { offerToSavePassword } from "@/utils/credentials";
import { useAdminAuth } from "../context/AdminAuthContext";
import {
  adminBeginTwoFactor,
  adminChangePassword,
  adminDisableTwoFactor,
  adminEnableTwoFactor,
  fetchAdminSession,
} from "../adminApi";
import "../components/AdminLayout.css";

/**
 * "My Security" — what every signed-in admin can do for their OWN account:
 *  1. change their password (which signs out their other devices), and
 *  2. switch two-factor sign-in (authenticator app) on or off.
 * Owners can also reset someone else's two-factor from Admin Users if that
 * person loses their phone.
 */
export default function AdminSecurity() {
  const { currentUser, updateCurrentUser } = useAdminAuth();

  return (
    <div>
      <h1>My Security</h1>
      <p className="admin-page-intro">Keep your account safe: use a strong password and turn on two-step verification.</p>
      <ChangePasswordCard email={currentUser?.email ?? ""} name={currentUser?.name ?? ""} />
      <TwoFactorCard enabled={Boolean(currentUser?.twoFactorEnabled)} onChanged={(enabled) => currentUser && updateCurrentUser({ ...currentUser, twoFactorEnabled: enabled })} />
    </div>
  );
}

/** Change-password form. The server signs out every other device and re-issues this one. */
function ChangePasswordCard({ email, name }: { email: string; name: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!current) nextErrors.current = "Enter your current password.";
    if (!next) nextErrors.next = "Enter a new password.";
    else if (!checkPassword(next, [name, email]).acceptable) nextErrors.next = "Your new password doesn't meet all the requirements below.";
    if (confirm !== next) nextErrors.confirm = "Passwords do not match.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("saving");
    setMessage(null);
    try {
      await adminChangePassword(current, next);
      void offerToSavePassword(email, next, name);
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Couldn't change your password.");
      setStatus("error");
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate name="admin-change-password">
      <h2>Change password</h2>
      {/* Tells the browser's password manager which saved login this belongs to. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" className="visually-hidden" />
      {status === "done" && (
        <FormStatusBanner status="success" successMessage="Password changed. Your other devices have been signed out." errorMessage={null} />
      )}
      {status === "error" && <FormStatusBanner status="error" successMessage="" errorMessage={message} />}

      <div className="form-grid">
        <FormField
          id="admin-current-password"
          name="current-password"
          label="Current password"
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current}
          autoComplete="current-password"
        />
        <NewPasswordField
          id="admin-new-password"
          label="New password"
          value={next}
          onChange={setNext}
          onSuggest={(password) => {
            setNext(password);
            setConfirm(password);
          }}
          personalData={[name, email]}
          error={errors.next}
        />
        <FormField
          id="admin-confirm-password"
          name="confirm-password"
          label="Confirm new password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          autoComplete="new-password"
        />
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

/** Two-step verification: shows a QR code to scan, confirms with a first code, then shows one-time recovery codes. */
function TwoFactorCard({ enabled, onChanged }: { enabled: boolean; onChanged: (enabled: boolean) => void }) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The signed-in user record may be stale (e.g. 2FA switched on in another tab): confirm with the server on open.
  useEffect(() => {
    fetchAdminSession()
      .then((user) => user && onChanged(Boolean(user.twoFactorEnabled)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { secret, otpauthUri } = await adminBeginTwoFactor();
      // The QR code is drawn in the browser — the secret never goes to a third-party QR service.
      setSetup({ secret, qr: await QRCode.toDataURL(otpauthUri, { margin: 1, width: 200 }) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { recoveryCodes: codes } = await adminEnableTwoFactor(code);
      setRecoveryCodes(codes);
      setSetup(null);
      setCode("");
      onChanged(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminDisableTwoFactor(password, code);
      setDisabling(false);
      setPassword("");
      setCode("");
      onChanged(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't turn off two-step verification.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card" style={{ marginTop: "var(--space-6)" }}>
      <h2>Two-step verification</h2>
      <p className="text-muted">
        Adds a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…) to signing in, so a stolen password alone isn't enough.
      </p>
      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      {recoveryCodes && (
        <div className="form-status form-status--success" role="status">
          <strong>Two-step verification is on.</strong> Save these recovery codes somewhere safe — each works once if you lose your phone. They won't be shown again.
          <ul className="mono" style={{ marginTop: "var(--space-3)", columns: 2 }}>
            {recoveryCodes.map((recovery) => (
              <li key={recovery}>{recovery}</li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={() => setRecoveryCodes(null)}>
            I've saved them
          </button>
        </div>
      )}

      {!enabled && !setup && (
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
            {busy ? "Starting…" : "Set up two-step verification"}
          </button>
        </div>
      )}

      {setup && (
        <form onSubmit={confirmSetup} noValidate>
          <ol>
            <li>Open your authenticator app and scan this code.</li>
            <li>
              <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} />
              <p className="text-muted">
                Can't scan? Enter this key instead: <span className="mono">{setup.secret}</span>
              </p>
            </li>
            <li>Type the 6-digit code the app shows to finish.</li>
          </ol>
          <div className="form-grid">
            <FormField
              id="admin-2fa-code"
              name="one-time-code"
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || !code.trim()}>
              {busy ? "Checking…" : "Turn on"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setSetup(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {enabled && !disabling && !recoveryCodes && (
        <div className="form-actions">
          <span className="text-muted">Two-step verification is <strong>on</strong>.</span>
          <button type="button" className="btn btn-secondary" onClick={() => setDisabling(true)}>
            Turn off
          </button>
        </div>
      )}

      {enabled && disabling && (
        <form onSubmit={turnOff} noValidate>
          <p className="text-muted">To turn it off, confirm your password and enter a current code (or a recovery code).</p>
          <div className="form-grid">
            <FormField
              id="admin-2fa-disable-password"
              name="password"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <FormField
              id="admin-2fa-disable-code"
              name="one-time-code"
              label="Code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || !password || !code.trim()}>
              {busy ? "Turning off…" : "Turn off"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setDisabling(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
