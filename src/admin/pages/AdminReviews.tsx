import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import AdminPagination from "../components/AdminPagination";
import SentimentBadge from "../components/SentimentBadge";
import { ApiError } from "@/services/http";
import type { AdminReview, ReviewStatus } from "@/types/review";
import type { Paginated } from "@/types/pagination";
import "../components/AdminLayout.css";
import "../components/AdminInsights.css";

const PAGE_SIZE = 20;
const FILTERS: Array<{ value: ReviewStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function AdminReviews() {
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: result, isLoading, error } = useAsyncData(
    () =>
      adminApi.get<Paginated<AdminReview>>(
        `/reviews/all?page=${page}&pageSize=${PAGE_SIZE}${filter === "all" ? "" : `&status=${filter}`}`
      ),
    [filter, page, refreshKey]
  );
  const reviews = result?.items ?? [];
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Approving/rejecting can empty the current page of a filtered list.
  useEffect(() => {
    if (!isLoading && result && result.items.length === 0 && page > 1) setPage((p) => p - 1);
  }, [isLoading, result, page]);

  async function setStatus(review: AdminReview, status: ReviewStatus) {
    setActionError(null);
    try {
      await adminApi.patch(`/reviews/${review.id}/status`, { status });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update the review.");
    }
  }

  async function handleDelete(review: AdminReview) {
    if (!window.confirm(`Permanently delete the review from ${review.authorName}? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await adminApi.delete(`/reviews/${review.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete the review.");
    }
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Reviews</h1>
        <Link to="/admin/insights" className="btn btn-secondary">
          View insights
        </Link>
      </div>
      <p className="admin-page-intro">
        Customer reviews stay hidden until you approve them. Sentiment is worked out automatically
        from the rating and the wording, to help you spot unhappy customers quickly.
      </p>

      <div className="insights-filters" role="tablist" aria-label="Filter reviews by status">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            className={filter === option.value ? "insights-filter insights-filter--active" : "insights-filter"}
            onClick={() => {
              setFilter(option.value);
              setPage(1);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}
      {isLoading && <p className="text-muted">Loading reviews…</p>}
      {error && <p className="text-muted" role="alert">Unable to load reviews.</p>}

      {result && reviews.length === 0 && (
        <div className="admin-empty-state">
          {filter === "pending" ? "Nothing waiting for moderation." : "No reviews in this view."}
        </div>
      )}

      {reviews.length > 0 && (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Review</th>
                  <th>About</th>
                  <th>Sentiment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <strong>{review.authorName}</strong>
                      <div className="text-muted mono">{new Date(review.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="review-cell">
                      <div className="mono">{review.rating} / 5</div>
                      <p>{review.comment}</p>
                    </td>
                    <td>
                      {review.vehicle ? (
                        <Link to={`/vehicles/${review.vehicle.slug}`} target="_blank" rel="noopener noreferrer">
                          {review.vehicle.make} {review.vehicle.model} {review.vehicle.year}
                        </Link>
                      ) : (
                        <span className="text-muted">The company</span>
                      )}
                    </td>
                    <td>
                      <SentimentBadge sentiment={review.sentiment} />
                    </td>
                    <td>{review.status}</td>
                    <td>
                      <div className="admin-table__actions">
                        {review.status !== "approved" && (
                          <button type="button" className="btn-ghost" onClick={() => setStatus(review, "approved")}>
                            Approve
                          </button>
                        )}
                        {review.status !== "rejected" && (
                          <button type="button" className="btn-ghost" onClick={() => setStatus(review, "rejected")}>
                            Reject
                          </button>
                        )}
                        <button type="button" className="btn-ghost" onClick={() => handleDelete(review)}>
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
