import { useState, type FormEvent, type ChangeEvent } from "react";
import FormField from "@/components/forms/FormField";
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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);
    try {
      if (user) {
        const payload: Record<string, unknown> = { name, role };
        if (password) payload.password = password;
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
        <FormField
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          disabled={!!user}
        />

        <FormField id="role" label="Role" as="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="OWNER">Owner — full access, manages other admins</option>
          <option value="MANAGER">Manager — vehicles, hire vehicles, requests</option>
          <option value="VIEWER">Viewer — read-only on submitted requests</option>
        </FormField>

        <FormField
          id="password"
          label={user ? "New Password (leave blank to keep current)" : "Password"}
          type="password"
          required={!user}
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
        />
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
