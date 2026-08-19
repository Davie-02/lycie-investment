import { useCallback, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi, type AdminUserSummary } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import AdminUserForm from "../components/AdminUserForm";
import { ApiError } from "@/services/http";
import "../components/AdminLayout.css";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; user: AdminUserSummary };

export default function AdminUsers() {
  const { currentUser } = useAdminAuth();
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: users, isLoading, error } = useAsyncData(
    () => adminApi.get<AdminUserSummary[]>("/admin-users"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleToggleActive(user: AdminUserSummary) {
    setActionError(null);
    try {
      await adminApi.patch(`/admin-users/${user.id}`, { isActive: !user.isActive });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update user.");
    }
  }

  async function handleDelete(user: AdminUserSummary) {
    if (!window.confirm(`Delete ${user.name}'s admin account? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await adminApi.delete(`/admin-users/${user.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete user.");
    }
  }

  if (view.mode === "create") {
    return (
      <AdminUserForm
        user={null}
        onSaved={() => {
          setView({ mode: "list" });
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "edit") {
    return (
      <AdminUserForm
        user={view.user}
        onSaved={() => {
          setView({ mode: "list" });
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Admin Users</h1>
        <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
          Add Admin User
        </button>
      </div>

      <p className="admin-page-intro">
        Owner has full access including managing other admins. Manager can edit vehicles, hire
        vehicles, and site content. Viewer can only see submitted requests.
      </p>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      {isLoading && <p className="text-muted">Loading admin users…</p>}
      {error && <p className="text-muted" role="alert">Unable to load admin users.</p>}

      {users && users.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    {user.id === currentUser?.id && <span className="text-muted"> (you)</span>}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span
                      className={`admin-badge ${user.isActive ? "admin-badge--available" : "admin-badge--sold"}`}
                    >
                      {user.isActive ? "active" : "inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button type="button" className="btn-ghost" onClick={() => setView({ mode: "edit", user })}>
                        Edit
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => handleToggleActive(user)}>
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      {user.id !== currentUser?.id && (
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(user)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
