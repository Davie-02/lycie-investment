/**
 * Form to add an admin account or edit one (name, role, new password, and an Owner-only
 * 'reset two-step verification'). Saves through POST/PATCH /api/admin-users; passwords
 * are checked against the same rules the server enforces.
 */
import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import NewPasswordField from "@/components/forms/NewPasswordField";
import { checkPassword } from "@/utils/password";
import { emailError } from "@/utils/email";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi, type AdminUserSummary } from "../adminApi";
import { ApiError } from "@/services/http";

interface AdminUserFormProps {
  user: AdminUserSummary | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function AdminUserForm({ user, onSaved, onCancel }: AdminUserFormProps) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "MANAGER");
  const [password, setPassword] = useState("");
  // Owner-only recovery: clears this person's authenticator setup (lost phone).
  const [resetTwoFactor, setResetTwoFactor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Same rules the server enforces, checked first so the person sees which one failed.
    if ((!user || password) && !checkPassword(password, [name, email]).acceptable) {
      setError("The password doesn't meet all the requirements listed under it.");
      return;
    }
    if (!user) {
      const emailProblem = emailError(email);
      if (emailProblem) {
        setError(emailProblem);
        return;
      }
    }

    setIsSaving(true);
    try {
      if (user) {
        const payload: Record<string, unknown> = { name, role };
        if (password) payload.password = password;
        if (resetTwoFactor) payload.resetTwoFactor = true;
        await adminApi.patch(`/admin-users/${user.id}`, payload);
      } else {
        await adminApi.post("/admin-users", { name, email, role, password });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save admin user.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{user ? `Edit ${user.name}` : "Add an Admin User"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="name"
          label="Name"
          required
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        />
        <EmailField id="email" value={email} onChange={setEmail} disabled={!!user} />

        <FormField id="role" label="Role" as="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="OWNER">Owner — full access, manages other admins</option>
          <option value="MANAGER">Manager — vehicles, hire vehicles, requests</option>
          <option value="VIEWER">Viewer — read-only on submitted requests</option>
        </FormField>

        <NewPasswordField
          id="password"
          label={user ? "New Password (leave blank to keep current)" : "Password"}
          required={!user}
          value={password}
          onChange={setPassword}
          personalData={[name, email]}
        />

        {(user?.totpEnabled || user?.twoFactorEnabled) && (
          <label className="form-check form-grid__full">
            <input type="checkbox" checked={resetTwoFactor} onChange={(e) => setResetTwoFactor(e.target.checked)} />
            <span>Reset their two-step verification (use if they've lost their phone and recovery codes)</span>
          </label>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : user ? "Save Changes" : "Add User"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
