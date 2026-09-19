import { useCallback, useEffect, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import FaqForm from "../components/FaqForm";
import AdminPagination from "../components/AdminPagination";
import { ApiError } from "@/services/http";
import type { Faq } from "@/types/faq";
import type { Paginated } from "@/types/pagination";
import "../components/AdminLayout.css";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; faq: Faq };

const PAGE_SIZE = 20;

export default function AdminFaq() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: result, isLoading, error } = useAsyncData(
    () => adminApi.get<Paginated<Faq>>(`/faq?page=${page}&pageSize=${PAGE_SIZE}`),
    [refreshKey, page]
  );
  const faqs = result?.items ?? [];

  useEffect(() => {
    if (!isLoading && result && result.items.length === 0 && page > 1) {
      setPage((p) => p - 1);
    }
  }, [isLoading, result, page]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleDelete(faq: Faq) {
    if (!window.confirm("Delete this FAQ? This cannot be undone.")) return;
    setActionError(null);
    try {
      await adminApi.delete(`/faq/${faq.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete FAQ.");
    }
  }

  if (view.mode === "create") {
    return (
      <FaqForm
        faq={null}
        onSaved={() => {
          setView({ mode: "list" });
          setPage(1);
          refresh();
        }}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "edit") {
    return (
      <FaqForm
        faq={view.faq}
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
        <h1>FAQ</h1>
        <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
          Add FAQ
        </button>
      </div>

      <p className="admin-page-intro">
        Shown on the homepage (first 5) and the full /faq page, grouped by category.
      </p>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      {isLoading && <p className="text-muted">Loading FAQs…</p>}
      {error && <p className="text-muted" role="alert">Unable to load FAQs.</p>}

      {result && faqs.length === 0 && (
        <div className="admin-empty-state">No FAQs yet. Add one to help answer common questions.</div>
      )}

      {faqs.length > 0 && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Category</th>
                  <th>Question</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.id}>
                    <td className="mono">{faq.sortOrder}</td>
                    <td>{faq.category ?? "—"}</td>
                    <td>{faq.question}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button type="button" className="btn-ghost" onClick={() => setView({ mode: "edit", faq })}>
                          Edit
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(faq)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AdminPagination page={page} pageSize={PAGE_SIZE} total={result?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
