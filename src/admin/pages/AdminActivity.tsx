import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import AdminPagination from "../components/AdminPagination";
import "../components/AdminLayout.css";

interface Activity {
  id: string;
  adminName: string;
  role: string;
  action: string;
  route: string;
  createdAt: string;
}

/** Who changed what, and when. Owner only. Records the action, never the content submitted. */
export default function AdminActivity() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<{ items: Activity[]; total: number; pageSize: number }>(`/admin-tools/activity?page=${page}`),
    [page]
  );

  return (
    <div>
      <h1>Activity</h1>
      <p className="admin-page-intro">
        A record of changes made in the admin — who did what, and when. Kept for six months. It records the action only, not
        the text or customer details involved.
      </p>

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
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td>
                      {item.adminName} <span className="text-muted">({item.role.toLowerCase()})</span>
                    </td>
                    <td title={item.route}>{item.action}</td>
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
