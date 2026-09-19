import { useCallback, useEffect, useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi, resolveUploadUrl } from "../adminApi";
import TestimonialForm from "../components/TestimonialForm";
import AdminPagination from "../components/AdminPagination";
import { ApiError } from "@/services/http";
import type { Testimonial } from "@/types/testimonial";
import type { Paginated } from "@/types/pagination";
import "../components/AdminLayout.css";

type View = { mode: "list" } | { mode: "create" } | { mode: "edit"; testimonial: Testimonial };

const PAGE_SIZE = 20;

export default function AdminTestimonials() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: result, isLoading, error } = useAsyncData(
    () => adminApi.get<Paginated<Testimonial>>(`/testimonials?page=${page}&pageSize=${PAGE_SIZE}`),
    [refreshKey, page]
  );
  const testimonials = result?.items ?? [];

  // If deleting left the current page empty (e.g. the last item on the
  // last page), fall back a page instead of showing a blank table.
  useEffect(() => {
    if (!isLoading && result && result.items.length === 0 && page > 1) {
      setPage((p) => p - 1);
    }
  }, [isLoading, result, page]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleDelete(testimonial: Testimonial) {
    if (!window.confirm(`Delete this testimonial from ${testimonial.authorName}? This cannot be undone.`)) {
      return;
    }
    setActionError(null);
    try {
      await adminApi.delete(`/testimonials/${testimonial.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete testimonial.");
    }
  }

  if (view.mode === "create") {
    return (
      <TestimonialForm
        testimonial={null}
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
      <TestimonialForm
        testimonial={view.testimonial}
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
        <h1>Testimonials</h1>
        <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "create" })}>
          Add Testimonial
        </button>
      </div>

      <p className="admin-page-intro">Shown on the homepage. Featured testimonials appear first.</p>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      {isLoading && <p className="text-muted">Loading testimonials…</p>}
      {error && <p className="text-muted" role="alert">Unable to load testimonials.</p>}

      {result && testimonials.length === 0 && (
        <div className="admin-empty-state">No testimonials yet. Add one to show it on the homepage.</div>
      )}

      {testimonials.length > 0 && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Quote</th>
                  <th>Rating</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {testimonials.map((testimonial) => (
                  <tr key={testimonial.id}>
                    <td>
                      <div className="admin-table__author">
                        {testimonial.authorPhotoUrl && (
                          <img
                            src={resolveUploadUrl(testimonial.authorPhotoUrl)}
                            alt=""
                            className="admin-table__avatar"
                          />
                        )}
                        <div>
                          <strong>{testimonial.authorName}</strong>
                          {testimonial.authorTitle && <div className="text-muted">{testimonial.authorTitle}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{testimonial.quote.length > 80 ? `${testimonial.quote.slice(0, 80)}…` : testimonial.quote}</td>
                    <td className="mono">{testimonial.rating} / 5</td>
                    <td>{testimonial.isFeatured ? "Yes" : "No"}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button type="button" className="btn-ghost" onClick={() => setView({ mode: "edit", testimonial })}>
                          Edit
                        </button>
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(testimonial)}>
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
