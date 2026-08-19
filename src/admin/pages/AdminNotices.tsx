import { useCallback, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import NoticeForm from "../components/NoticeForm";
import { ApiError } from "@/services/http";
import { NOTICE_TYPE_STYLES, NOTICE_TYPE_LABELS, type Notice } from "@/types/notice";
import "../components/AdminLayout.css";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; notice: Notice };

export default function AdminNotices() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: notices, isLoading, error } = useAsyncData(
    () => adminApi.get<Notice[]>("/notices/all"),
    [refreshKey]
  );

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleToggleActive(notice: Notice) {
    setActionError(null);
    try {
      await adminApi.patch(`/notices/${notice.id}`, { isActive: !notice.isActive });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update notice.");
    }
  }

  async function handleDelete(notice: Notice) {
    if (!window.confirm("Delete this notice? This cannot be undone.")) return;
    setActionError(null);
    try {
      await adminApi.delete(`/notices/${notice.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete notice.");
    }
  }

  if (view.mode === "create") {
    return (
      <NoticeForm
        notice={null}
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
      <NoticeForm
        notice={view.notice}
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
        <h1>Notices</h1>
        <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
          Add Notice
        </button>
      </div>

      <p className="admin-page-intro">
        Banners show at the top of every page. Popups show once per visitor session. Turn a
        notice off to hide it without deleting it.
      </p>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      {isLoading && <p className="text-muted">Loading notices…</p>}
      {error && <p className="text-muted" role="alert">Unable to load notices.</p>}

      {notices && notices.length === 0 && (
        <div className="admin-empty-state">No notices yet. Add one to display an announcement, warning, or special offer.</div>
      )}

      {notices && notices.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Show as</th>
                <th>Message</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((notice) => {
                const style = NOTICE_TYPE_STYLES[notice.type];
                return (
                  <tr key={notice.id}>
                    <td>
                      <span
                        className="admin-badge"
                        style={{ color: style.text, borderColor: style.border, background: style.background }}
                      >
                        {NOTICE_TYPE_LABELS[notice.type]}
                      </span>
                    </td>
                    <td>{notice.displayAs === "banner" ? "Banner" : "Popup"}</td>
                    <td>{notice.title ? `${notice.title}: ` : ""}{notice.message}</td>
                    <td>
                      <span className={`admin-badge ${notice.isActive ? "admin-badge--available" : "admin-badge--sold"}`}>
                        {notice.isActive ? "on" : "off"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        <button type="button" className="btn-ghost" onClick={() => setView({ mode: "edit", notice })}>
                          Edit
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => handleToggleActive(notice)}>
                          {notice.isActive ? "Turn off" : "Turn on"}
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(notice)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
