import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { adminApi } from "../adminApi";
import AdminPagination from "./AdminPagination";
import { ApiError } from "@/services/http";
import "./AdminLayout.css";
import "./AdminInsights.css";
import "./ContentManager.css";

export type ContentType = "vehicles" | "hire-vehicles" | "testimonials" | "faq" | "blog-posts" | "notices";
type StateFilter = "all" | "published" | "unpublished" | "archived";
type Action = "publish" | "unpublish" | "archive" | "restore" | "delete";

interface Counts {
  all: number;
  published: number;
  unpublished: number;
  archived: number;
}

interface ListResult<T> {
  items: T[];
  total: number;
  counts: Counts;
}

export interface Column<T> {
  header: string;
  render: (item: T) => ReactNode;
}

interface ContentManagerProps<T extends { id: string }> {
  type: ContentType;
  title: string;
  /** Singular, lower-case: "vehicle", "FAQ" — used in buttons and messages. */
  noun: string;
  intro?: string;
  columns: Column<T>[];
  renderForm: (item: T | null, onDone: () => void, onCancel: () => void) => ReactNode;
  /** A short human name for confirmations, e.g. "Toyota Hilux (2022)". */
  describe: (item: T) => string;
  /** Is this item currently live on the public site? */
  isLive: (item: T) => boolean;
  isArchived: (item: T) => boolean;
  canEdit: boolean;
  /** Extra per-row buttons (e.g. "Mark sold"). */
  extraActions?: (item: T, refresh: () => void) => ReactNode;
  pageSize?: number;
}

const TABS: Array<{ value: StateFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "published", label: "Live" },
  { value: "unpublished", label: "Drafts" },
  { value: "archived", label: "Archived" },
];

const ACTION_LABEL: Record<Action, string> = {
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore",
  delete: "Delete",
};

/**
 * One list-and-manage screen for every kind of content: filter by state,
 * search, select several items and publish / unpublish / archive / restore /
 * delete them together, duplicate an item as a draft to relist it later.
 * Keeps showing the previous results while a refresh loads, so the screen
 * never blanks out or jumps.
 */
export default function ContentManager<T extends { id: string }>(props: ContentManagerProps<T>) {
  const { type, title, noun, intro, columns, renderForm, describe, isLive, isArchived, canEdit, extraActions } = props;
  const pageSize = props.pageSize ?? 20;

  const [view, setView] = useState<{ mode: "list" } | { mode: "form"; item: T | null }>({ mode: "list" });
  const [state, setState] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<ListResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const ticket = ++latest.current;
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (state !== "all") params.set("state", state);
    if (debouncedQuery) params.set("q", debouncedQuery);
    adminApi
      .get<ListResult<T>>(`/content-admin/${type}?${params.toString()}`)
      .then((data) => {
        if (ticket !== latest.current) return; // a newer request superseded this one
        setResult(data);
        setLoadError(false);
        if (data.items.length === 0 && page > 1) setPage((p) => p - 1);
      })
      .catch(() => ticket === latest.current && setLoadError(true))
      .finally(() => ticket === latest.current && setIsLoading(false));
  }, [type, state, debouncedQuery, page, pageSize, refreshKey]);

  useEffect(() => setSelected(new Set()), [state, debouncedQuery, page, type]);

  async function run(ids: string[], action: Action, label?: string) {
    if (ids.length === 0) return;
    if (action === "delete") {
      const what = ids.length === 1 && label ? `“${label}”` : `${ids.length} ${noun}s`;
      if (!window.confirm(`Permanently delete ${what}? This cannot be undone. (Archive keeps it so you can reuse it later.)`)) return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await adminApi.post(`/content-admin/${type}/bulk`, { ids, action });
      setMessage({ kind: "ok", text: `${ACTION_LABEL[action]} done for ${ids.length} ${ids.length === 1 ? noun : `${noun}s`}.` });
      setSelected(new Set());
      refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : `Could not ${action}.` });
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(item: T) {
    setBusy(true);
    setMessage(null);
    try {
      await adminApi.post(`/content-admin/${type}/${item.id}/duplicate`, {});
      setMessage({ kind: "ok", text: `Copied “${describe(item)}” as a hidden draft — edit it, then publish.` });
      setState("unpublished");
      refresh();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof ApiError ? err.message : "Could not duplicate." });
    } finally {
      setBusy(false);
    }
  }

  if (view.mode === "form") {
    return (
      <>
        {renderForm(
          view.item,
          () => {
            setView({ mode: "list" });
            refresh();
          },
          () => setView({ mode: "list" })
        )}
      </>
    );
  }

  const items = result?.items ?? [];
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const selectedIds = [...selected];
  const inArchive = state === "archived";

  return (
    <div>
      <div className="admin-toolbar">
        <h1>{title}</h1>
        {canEdit && (
          <button type="button" className="btn btn-primary" onClick={() => setView({ mode: "form", item: null })}>
            Add {noun}
          </button>
        )}
      </div>
      {intro && <p className="admin-page-intro">{intro}</p>}

      <div className="cm-controls">
        <div className="insights-filters" role="tablist" aria-label={`Filter ${noun}s`}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={state === tab.value}
              className={state === tab.value ? "insights-filter insights-filter--active" : "insights-filter"}
              onClick={() => {
                setState(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
              {result && <span className="cm-count">{result.counts[tab.value]}</span>}
            </button>
          ))}
        </div>
        <label className="cm-search">
          <span className="cm-sr">Search {noun}s</span>
          <input type="search" placeholder={`Search ${noun}s…`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {message && (
        <p className={message.kind === "ok" ? "cm-message" : "admin-error-text"} role={message.kind === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      {canEdit && selectedIds.length > 0 && (
        <div className="cm-bulk" role="region" aria-label="Bulk actions">
          <strong>{selectedIds.length} selected</strong>
          {!inArchive && (
            <>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(selectedIds, "publish")}>Publish</button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(selectedIds, "unpublish")}>Unpublish</button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(selectedIds, "archive")}>Archive</button>
            </>
          )}
          {inArchive && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(selectedIds, "restore")}>Restore</button>
          )}
          <button type="button" className="btn-ghost cm-danger" disabled={busy} onClick={() => run(selectedIds, "delete")}>Delete</button>
        </div>
      )}

      {loadError && <p className="text-muted" role="alert">Unable to load {noun}s. <button type="button" className="btn-ghost" onClick={refresh}>Retry</button></p>}
      {!result && isLoading && <p className="text-muted">Loading…</p>}

      {result && items.length === 0 && (
        <div className="admin-empty-state">
          {debouncedQuery ? `No ${noun}s match “${debouncedQuery}”.` : state === "archived" ? `Nothing archived.` : `No ${noun}s here yet.`}
        </div>
      )}

      {items.length > 0 && (
        <div className={isLoading ? "admin-table-wrap cm-refreshing" : "admin-table-wrap"}>
          <table className="admin-table">
            <thead>
              <tr>
                {canEdit && (
                  <th className="cm-check">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const archived = isArchived(item);
                const live = isLive(item);
                return (
                  <tr key={item.id} className={archived ? "cm-row--archived" : undefined}>
                    {canEdit && (
                      <td className="cm-check">
                        <input
                          type="checkbox"
                          aria-label={`Select ${describe(item)}`}
                          checked={selected.has(item.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })
                          }
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.header}>{c.render(item)}</td>
                    ))}
                    <td>
                      <span className={archived ? "admin-badge admin-badge--sold" : live ? "admin-badge admin-badge--available" : "admin-badge admin-badge--reserved"}>
                        {archived ? "Archived" : live ? "Live" : "Draft"}
                      </span>
                    </td>
                    <td>
                      {canEdit ? (
                        <div className="admin-table__actions cm-actions">
                          {!archived && (
                            <button type="button" className="btn-ghost" onClick={() => setView({ mode: "form", item })}>Edit</button>
                          )}
                          {!archived && (
                            <button type="button" className="btn-ghost" disabled={busy} onClick={() => run([item.id], live ? "unpublish" : "publish")}>
                              {live ? "Unpublish" : "Publish"}
                            </button>
                          )}
                          {extraActions?.(item, refresh)}
                          <button type="button" className="btn-ghost" disabled={busy} onClick={() => duplicate(item)} title="Copy as a hidden draft">
                            Duplicate
                          </button>
                          <button type="button" className="btn-ghost" disabled={busy} onClick={() => run([item.id], archived ? "restore" : "archive")}>
                            {archived ? "Restore" : "Archive"}
                          </button>
                          <button type="button" className="btn-ghost cm-danger" disabled={busy} onClick={() => run([item.id], "delete", describe(item))}>
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted">View only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination page={page} pageSize={pageSize} total={result?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
