import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { ApiError } from "@/services/http";
import { adminApi, undoAdminAction } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import AdminPagination from "../components/AdminPagination";
import "../components/AdminLayout.css";
import "@/components/forms/FormField.css";

interface Activity {
  id: string;
  adminId: string;
  adminName: string;
  role: string;
  action: string;
  route: string;
  createdAt: string;
  undoable: boolean;
  undoneAt: string | null;
  undoneBy: string | null;
  undoOfId: string | null;
  changeCount: number;
  canUndo: boolean;
}

interface ActivityPage {
  items: Activity[];
  total: number;
  pageSize: number;
  undoWindowDays: number;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Who changed what, and when — and the place to undo a change made by
 * mistake. Owners see everyone's actions and can undo any of them; Managers
 * see and undo their own. Records the action only, never the content submitted.
 */
export default function AdminActivity() {
  const { currentUser } = useAdminAuth();
  const isOwner = currentUser?.role === "OWNER";
  const [page, setPage] = useState(1);
  const [mineOnly, setMineOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string; conflictId?: string } | null>(null);

  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<ActivityPage>(`/admin-tools/activity?page=${page}${mineOnly ? "&mine=1" : ""}`),
    [page, mineOnly]
  );

  async function undo(item: Activity, force = false) {
    const verb = item.undoOfId ? "Redo" : "Undo";
    if (!force && !window.confirm(`${verb} "${item.action}"?\n\nEverything this action changed will be put back the way it was.`)) return;
    setBusyId(item.id);
    setMessage(null);
    try {
      const result = await undoAdminAction(item.id, force);
      // The page remounts after an undo (AdminLayout), so this message mostly shows via the Undo bar.
      setMessage({ tone: "ok", text: [`Undone: ${result.action}.`, ...result.notes].join(" ") });
    } catch (err) {
      const text = err instanceof Error ? err.message : "Couldn't undo that.";
      setMessage({ tone: "error", text, conflictId: err instanceof ApiError && err.status === 409 ? item.id : undefined });
    } finally {
      setBusyId(null);
    }
  }

  const conflictItem = message?.conflictId ? data?.items.find((item) => item.id === message.conflictId) : undefined;

  return (
    <div>
      <h1>{isOwner ? "Activity & Undo" : "My Activity & Undo"}</h1>
      <p className="admin-page-intro">
        A record of changes made in the admin — who did what, and when — kept for six months. Made a mistake? Press
        <strong> Undo</strong> to put everything that action changed back the way it was
        {data ? ` (possible for ${data.undoWindowDays} days)` : ""}. Undoing is recorded too, so it can be redone. Emails or
        social posts that were already sent can't be recalled. {isOwner ? "Owners can undo anyone's action." : "You can undo your own actions."}
      </p>

      {isOwner && (
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "1rem" }}>
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => {
              setMineOnly(event.target.checked);
              setPage(1);
            }}
          />{" "}
          Only my actions
        </label>
      )}

      {message && (
        <div className={message.tone === "ok" ? "form-status form-status--success" : "form-status form-status--error"} role="alert">
          {message.text}
          {conflictItem && (
            <>
              {" "}
              <button type="button" className="btn btn-secondary" onClick={() => void undo(conflictItem, true)}>
                Undo anyway
              </button>
            </>
          )}
        </div>
      )}

      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {error && <p className="text-muted" role="alert">Unable to load activity.</p>}
      {data && data.items.length === 0 && <div className="admin-empty-state">Nothing recorded yet.</div>}

      {data && data.items.length > 0 && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Undo</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{when(item.createdAt)}</td>
                    <td>
                      {item.adminName} <span className="text-muted">({item.role.toLowerCase()})</span>
                    </td>
                    <td title={item.route}>
                      {item.action}
                      {item.undoneAt && (
                        <div className="text-muted">
                          Undone by {item.undoneBy ?? "an admin"} · {when(item.undoneAt)}
                        </div>
                      )}
                    </td>
                    <td>
                      {item.canUndo ? (
                        <button type="button" className="btn btn-secondary" disabled={busyId !== null} onClick={() => void undo(item)}>
                          {busyId === item.id ? "Working…" : item.undoOfId ? "Redo" : "Undo"}
                        </button>
                      ) : (
                        <span className="text-muted">
                          {item.undoneAt ? "Undone" : !item.undoable ? "—" : "Not available"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination page={page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
