/**
 * "Confirm it's you" — asked before the most sensitive staff changes (new
 * administrators, changing someone's access or role, deleting accounts,
 * resetting two-step sign-in). Password, plus the authenticator code when
 * two-step is on. Valid for 10 minutes, then asked again.
 *
 * Use withStepUp(action): runs the action; if the server answers
 * STEP_UP_REQUIRED, shows this dialog and retries once confirmed.
 */
import { useCallback, useRef, useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import { ApiError } from "@/services/http";
import { adminConfirmIdentity } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";

export function useStepUp() {
  const [open, setOpen] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  const withStepUp = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "STEP_UP_REQUIRED")) throw error;
      await new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        setOpen(true);
      });
      return action();
    }
  }, []);

  const dialog = open ? (
    <StepUpDialog
      onConfirmed={() => {
        setOpen(false);
        pending.current?.resolve();
      }}
      onCancel={() => {
        setOpen(false);
        pending.current?.reject(new Error("Cancelled — nothing was changed."));
      }}
    />
  ) : null;

  return { withStepUp, dialog };
}

function StepUpDialog({ onConfirmed, onCancel }: { onConfirmed: () => void; onCancel: () => void }) {
  const { currentUser } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsCode = Boolean(currentUser?.twoFactorEnabled);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminConfirmIdentity(password, needsCode ? code : undefined);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't confirm.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-dialog-backdrop" role="presentation">
      <form className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby="stepup-title" onSubmit={submit}>
        <h2 id="stepup-title">Confirm it's you</h2>
        <p className="text-muted">This change affects who can do what, so we need to check it's really you. You won't be asked again for 10 minutes.</p>
        {error && <p className="form-status form-status--error" role="alert">{error}</p>}
        <input type="text" name="username" autoComplete="username" value={currentUser?.email ?? ""} readOnly hidden />
        <FormField id="stepup-password" label="Your password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        {needsCode && (
          <FormField id="stepup-code" label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Confirm"}
          </button>
          <button className="btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
