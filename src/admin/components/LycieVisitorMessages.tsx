import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import SentimentBadge from "./SentimentBadge";
import { ApiError } from "@/services/http";
import type { SubmissionList } from "@/types/lycie";

type Filter = "all" | "question" | "comment";

export default function LycieVisitorMessages() {
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: loadError } = useAsyncData(
    () => adminApi.get<SubmissionList>(`/lycie/submissions${filter === "all" ? "" : `?kind=${filter}`}`),
    [filter, refreshKey]
  );
  const refresh = () => setRefreshKey((k) => k + 1);

  async function act(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  }

  return (
    <section className="insights-section">
      <h2>Visitor questions & comments</h2>
      <p className="text-muted">
        Sent anonymously from the FAQ page. Questions also feed the FAQ analysis. Personal details are removed on
        arrival, and messages are deleted automatically after the retention period.
      </p>

      <div className="insights-filters" role="tablist" aria-label="Filter messages">
        {(["all", "question", "comment"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? "insights-filter insights-filter--active" : "insights-filter"}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : value === "question" ? "Questions" : "Comments"}
          </button>
        ))}
      </div>

      {error && <p className="admin-error-text" role="alert">{error}</p>}
      {isLoading && <p className="text-muted">Loading…</p>}
      {loadError && <p className="text-muted" role="alert">Unable to load messages.</p>}
      {data && data.items.length === 0 && <div className="admin-empty-state">Nothing here yet.</div>}

      <ul className="lycie-log-list">
        {(data?.items ?? []).map((item) => (
          <li key={item.id}>
            <div className="lycie-log-list__head">
              <span className="admin-badge">{item.kind === "question" ? "Question" : "Comment"}</span>
              {item.sentiment && <SentimentBadge sentiment={item.sentiment} />}
              <span className={item.status === "new" ? "admin-badge admin-badge--reserved" : "admin-badge admin-badge--available"}>
                {item.status === "new" ? "New" : "Handled"}
              </span>
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </time>
            </div>
            <p className="lycie-log-list__full">{item.message}</p>
            <div className="admin-table__actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  act(() => adminApi.patch(`/lycie/submissions/${item.id}`, { status: item.status === "new" ? "handled" : "new" }))
                }
              >
                {item.status === "new" ? "Mark handled" : "Mark as new"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (window.confirm("Delete this message permanently?")) void act(() => adminApi.delete(`/lycie/submissions/${item.id}`));
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
