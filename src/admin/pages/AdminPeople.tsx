/**
 * Staff (People → Staff) and Staff & access (System → Staff & access).
 *
 * - Invite: name, email, department, job title. The server emails a strong
 *   one-time password; the person must choose their own at first sign-in.
 *   If email isn't set up, the password is shown here once to hand over.
 * - Edit profile, department, deactivate, re-send the invitation.
 * - System administrators also: add other administrators, and set each
 *   person's module access — "extend" or "limit" beyond their department's
 *   defaults, module by module. Sensitive changes ask "Confirm it's you".
 */
import { useMemo, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import FormField from "@/components/forms/FormField";
import EmailField from "@/components/forms/EmailField";
import { ApiError } from "@/services/http";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useStepUp } from "../components/StepUpDialog";
import { LEVELS, LEVEL_HELP, LEVEL_LABELS, type AccessMap, type Level, type ModuleKey } from "../access";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "VIEWER" | "EMPLOYEE";
  isActive: boolean;
  createdAt: string;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  department: string | null;
  jobTitle: string | null;
  phone: string | null;
  mustChangePassword: boolean;
  invitedAt: string | null;
  tempPasswordExpiresAt: string | null;
  access: AccessMap;
  overrides: Partial<Record<ModuleKey, Level>>;
}

interface Catalog {
  modules: Array<{ key: ModuleKey; label: string; description: string }>;
  departments: Array<{ key: string; label: string; access: Partial<Record<ModuleKey, Level>> }>;
}

interface SaveResult {
  user: StaffRecord;
  inviteEmailed?: boolean;
  temporaryPassword?: string;
  inviteExpiresAt?: string;
}

const ROLE_LABEL: Record<string, string> = { OWNER: "System administrator", MANAGER: "Manager (older account)", VIEWER: "Viewer (older account)", EMPLOYEE: "Staff" };

function statusOf(user: StaffRecord): { text: string; tone: "good" | "bad" | "warn" | "" } {
  if (!user.isActive) return { text: "Deactivated", tone: "bad" };
  if (user.mustChangePassword) {
    const expired = user.tempPasswordExpiresAt && new Date(user.tempPasswordExpiresAt) < new Date();
    return { text: expired ? "Invitation expired" : "Invited", tone: "warn" };
  }
  return { text: "Active", tone: "good" };
}

export default function AdminPeople() {
  const { currentUser, isSystemAdmin, refreshUser } = useAdminAuth();
  const accessMode = useLocation().pathname === "/admin/users";
  const { withStepUp, dialog } = useStepUp();
  const [refresh, setRefresh] = useState(0);
  const { data: users, isLoading, error } = useAsyncData(() => adminApi.get<StaffRecord[]>("/admin-users"), [refresh]);
  const { data: catalog } = useAsyncData(() => adminApi.get<Catalog>("/admin-users/catalog"), []);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [editing, setEditing] = useState<StaffRecord | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string; password?: string } | null>(null);

  const departmentLabel = (key: string | null) => catalog?.departments.find((d) => d.key === key)?.label ?? (key ? key : "—");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (users ?? []).filter(
      (u) =>
        (!department || u.department === department || (department === "_none" && !u.department)) &&
        (!term || `${u.name} ${u.email} ${u.jobTitle ?? ""}`.toLowerCase().includes(term))
    );
  }, [users, query, department]);

  function afterSave(result: SaveResult, verb: string) {
    setEditing(null);
    setRefresh((n) => n + 1);
    if (result.temporaryPassword) {
      setNotice({
        tone: "ok",
        text: `${verb}. Email isn't set up, so give ${result.user.name} this one-time password in person (it's shown only now and must be changed at first sign-in):`,
        password: result.temporaryPassword,
      });
    } else {
      setNotice({ tone: "ok", text: result.inviteEmailed ? `${verb}. An invitation with a one-time password was emailed to ${result.user.email}.` : `${verb}.` });
    }
    if (result.user.id === currentUser?.id) void refreshUser();
  }

  async function quick(user: StaffRecord, body: Record<string, unknown>, verb: string) {
    setNotice(null);
    try {
      const result = await withStepUp(() => adminApi.patch<SaveResult>(`/admin-users/${user.id}`, body));
      afterSave(result, verb);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Couldn't save." });
    }
  }

  async function remove(user: StaffRecord) {
    if (!window.confirm(`Delete ${user.name}'s account completely? Deactivating keeps their history and is usually better.`)) return;
    try {
      await withStepUp(() => adminApi.delete(`/admin-users/${user.id}`));
      setRefresh((n) => n + 1);
      setNotice({ tone: "ok", text: `${user.name}'s account was deleted.` });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Couldn't delete." });
    }
  }

  if (editing) {
    return (
      <>
        <StaffForm
          user={editing === "new" ? null : editing}
          catalog={catalog}
          isSystemAdmin={isSystemAdmin}
          selfId={currentUser?.id}
          withStepUp={withStepUp}
          onSaved={afterSave}
          onCancel={() => setEditing(null)}
        />
        {dialog}
      </>
    );
  }

  return (
    <div>
      <div className="ws-hero">
        <div>
          <h1>{accessMode ? "Staff & access" : "Staff"}</h1>
          <p>
            {accessMode
              ? "Who can use which module. Each department has sensible defaults; extend or limit anyone's access individually."
              : "Invite colleagues and keep their details up to date. Invitations email a one-time password that must be changed at first sign-in."}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
          + Invite staff member
        </button>
      </div>

      {notice && (
        <div className={notice.tone === "ok" ? "form-status form-status--success" : "form-status form-status--error"} role="status">
          {notice.text}
          {notice.password && (
            <div className="ws-secret" style={{ marginTop: "0.6rem" }}>
              <span>{notice.password}</span>
              <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard?.writeText(notice.password!)}>
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ws-toolbar">
        <input type="search" placeholder="Search name, email or job…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search staff" />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {catalog?.departments.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
          <option value="_none">No department</option>
        </select>
        <span className="text-muted">{filtered.length} people</span>
      </div>

      {isLoading && !users && <p className="text-muted">Loading…</p>}
      {error && <p className="text-muted" role="alert">{error}</p>}

      {users && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department & role</th>
                <th>Status</th>
                {accessMode && <th>Access</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const status = statusOf(user);
                const isAdminAccount = user.role === "OWNER";
                const canTouch = isSystemAdmin || !isAdminAccount;
                return (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                      <div className="text-muted">{user.email}</div>
                      {user.jobTitle && <div className="text-muted">{user.jobTitle}</div>}
                    </td>
                    <td>
                      {departmentLabel(user.department)}
                      <div>
                        <span className={isAdminAccount ? "ws-chip ws-chip--bad" : "ws-chip"}>{ROLE_LABEL[user.role]}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`ws-chip ws-chip--${status.tone}`}>{status.text}</span>
                      <div className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>
                        {user.totpEnabled ? "Two-step on" : "Two-step off"}
                        {user.lastLoginAt ? ` · last in ${new Date(user.lastLoginAt).toLocaleDateString()}` : ""}
                      </div>
                    </td>
                    {accessMode && (
                      <td>
                        <AccessSummary access={user.access} overrides={user.overrides} catalog={catalog} />
                      </td>
                    )}
                    <td>
                      {canTouch ? (
                        <div className="admin-table__actions" style={{ flexWrap: "wrap" }}>
                          <button type="button" className="btn btn-secondary" onClick={() => setEditing(user)}>
                            Edit
                          </button>
                          {user.mustChangePassword && user.isActive && (
                            <button type="button" className="btn-ghost" onClick={() => void quick(user, { resendInvite: true }, "Invitation sent again")}>
                              Re-send invite
                            </button>
                          )}
                          {user.id !== currentUser?.id && (
                            <button
                              type="button"
                              className="btn-ghost"
                              onClick={() => void quick(user, { isActive: !user.isActive }, user.isActive ? `${user.name} was deactivated` : `${user.name} was re-activated`)}
                            >
                              {user.isActive ? "Deactivate" : "Re-activate"}
                            </button>
                          )}
                          {isSystemAdmin && user.id !== currentUser?.id && (
                            <button type="button" className="btn-ghost" onClick={() => void remove(user)}>
                              Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">Administrator — only a system administrator can change this account.</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </div>
  );
}

function AccessSummary({ access, overrides, catalog }: { access: AccessMap; overrides: Partial<Record<ModuleKey, Level>>; catalog: Catalog | null }) {
  const granted = (catalog?.modules ?? []).filter((m) => access[m.key] && access[m.key] !== "none");
  if (granted.length === 0) return <span className="text-muted">Dashboard only</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
      {granted.map((m) => (
        <span key={m.key} className={overrides[m.key] ? "ws-chip ws-chip--warn" : "ws-chip"} title={overrides[m.key] ? "Set individually" : "From department"}>
          {m.label}: {LEVEL_LABELS[access[m.key]]}
        </span>
      ))}
    </div>
  );
}

interface StaffFormProps {
  user: StaffRecord | null;
  catalog: Catalog | null;
  isSystemAdmin: boolean;
  selfId?: string;
  withStepUp: <T>(action: () => Promise<T>) => Promise<T>;
  onSaved: (result: SaveResult, verb: string) => void;
  onCancel: () => void;
}

function StaffForm({ user, catalog, isSystemAdmin, selfId, withStepUp, onSaved, onCancel }: StaffFormProps) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [department, setDepartment] = useState(user?.department ?? "general");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "EMPLOYEE");
  const [overrides, setOverrides] = useState<Partial<Record<ModuleKey, Level>>>(user?.overrides ?? {});
  const [resetTwoFactor, setResetTwoFactor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSelf = user?.id === selfId;

  const defaults = catalog?.departments.find((d) => d.key === department)?.access ?? {};
  const effective = (key: ModuleKey): Level => overrides[key] ?? defaults[key] ?? "none";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const accessChanged = JSON.stringify(overrides) !== JSON.stringify(user?.overrides ?? {});
      if (!user) {
        const body: Record<string, unknown> = { name, email, role, department: role === "OWNER" ? undefined : department, jobTitle, phone };
        if (isSystemAdmin && role !== "OWNER" && Object.keys(overrides).length) body.permissions = overrides;
        onSaved(await withStepUp(() => adminApi.post<SaveResult>("/admin-users", body)), `${name} was invited`);
      } else {
        const body: Record<string, unknown> = { name, department: department || null, jobTitle, phone };
        if (isSystemAdmin && !isSelf && role !== user.role) body.role = role;
        if (isSystemAdmin && !isSelf && accessChanged) body.permissions = Object.keys(overrides).length ? overrides : null;
        if (resetTwoFactor) body.resetTwoFactor = true;
        onSaved(await withStepUp(() => adminApi.patch<SaveResult>(`/admin-users/${user.id}`, body)), `${name}'s account was updated`);
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <h1 style={{ marginTop: 0 }}>{user ? `Edit ${user.name}` : "Invite a staff member"}</h1>
      {!user && (
        <p className="text-muted">
          They'll get an email with a sign-in link and a strong one-time password (valid 72 hours). At first sign-in they must choose their own password.
        </p>
      )}
      {error && <p className="form-status form-status--error" role="alert">{error}</p>}

      <div className="form-grid form-grid--2col">
        <FormField id="staff-name" label="Full name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        {user ? (
          <FormField id="staff-email" label="Email" value={email} disabled />
        ) : (
          <EmailField id="staff-email" value={email} onChange={setEmail} />
        )}
        <FormField id="staff-title" label="Job title" placeholder="e.g. Sales executive" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} />
        <FormField id="staff-phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
        {isSystemAdmin && !isSelf && (
          <FormField as="select" id="staff-role" label="Account type" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="EMPLOYEE">Staff (access by department)</option>
            <option value="OWNER">System administrator (everything)</option>
            {user && (user.role === "MANAGER" || user.role === "VIEWER") && <option value={user.role}>{ROLE_LABEL[user.role]}</option>}
          </FormField>
        )}
        {role !== "OWNER" && (
          <FormField as="select" id="staff-dept" label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
            {catalog?.departments.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </FormField>
        )}
      </div>

      {role === "OWNER" && (
        <p className="form-status form-status--info">
          System administrators can do everything, including managing other administrators. They sign in only through the secure administrator
          portal and must use two-step verification.
        </p>
      )}

      {role !== "OWNER" && catalog && (
        <fieldset className="site-content-fieldset" style={{ marginTop: "1rem" }}>
          <legend>Module access</legend>
          <p className="text-muted" style={{ marginTop: 0 }}>
            {isSystemAdmin && !isSelf
              ? "Starts from the department's defaults. Change any module to extend or limit this person's access; highlighted rows differ from the department."
              : "Set by the department. Only a system administrator can change individual access."}
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Department default</th>
                  <th>This person</th>
                </tr>
              </thead>
              <tbody>
                {catalog.modules.map((module) => {
                  const overridden = overrides[module.key] !== undefined && overrides[module.key] !== (defaults[module.key] ?? "none");
                  return (
                    <tr key={module.key} style={overridden ? { background: "var(--color-warn-bg)" } : undefined}>
                      <td>
                        <strong>{module.label}</strong>
                        <div className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>{module.description}</div>
                      </td>
                      <td>{LEVEL_LABELS[defaults[module.key] ?? "none"]}</td>
                      <td>
                        {isSystemAdmin && !isSelf ? (
                          <select
                            aria-label={`${module.label} access`}
                            value={effective(module.key)}
                            onChange={(e) => {
                              const level = e.target.value as Level;
                              setOverrides((prev) => {
                                const next = { ...prev };
                                if (level === (defaults[module.key] ?? "none")) delete next[module.key];
                                else next[module.key] = level;
                                return next;
                              });
                            }}
                          >
                            {LEVELS.map((level) => (
                              <option key={level} value={level} title={LEVEL_HELP[level]}>
                                {LEVEL_LABELS[level]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          LEVEL_LABELS[effective(module.key)]
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {isSystemAdmin && !isSelf && Object.keys(overrides).length > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setOverrides({})}>
              Reset to department defaults
            </button>
          )}
        </fieldset>
      )}

      {user && isSystemAdmin && user.totpEnabled && !isSelf && (
        <label style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <input type="checkbox" checked={resetTwoFactor} onChange={(e) => setResetTwoFactor(e.target.checked)} />
          Reset their two-step verification (they lost their phone and recovery codes)
        </label>
      )}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : user ? "Save changes" : "Send invitation"}
        </button>
        <button className="btn-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
