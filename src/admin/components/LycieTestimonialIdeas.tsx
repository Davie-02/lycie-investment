/**
 * Admin panel listing positive reviews Lycie spotted as good testimonials. Staff can
 * publish one as a testimonial or dismiss it, or trigger a new scan. Uses
 * /api/lycie/testimonial-ideas.
 */
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import FormField from "@/components/forms/FormField";
import { ApiError } from "@/services/http";
import type { TestimonialIdea } from "@/types/lycie";

interface Draft {
  quote: string;
  authorName: string;
  authorTitle: string;
  rating: string;
}

export default function LycieTestimonialIdeas() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading } = useAsyncData(() => adminApi.get<TestimonialIdea[]>("/lycie/testimonial-ideas"), [refreshKey]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const refresh = () => setRefreshKey((k) => k + 1);

  async function run(key: string, action: () => Promise<unknown>, done?: string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (done) setNotice(done);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="insights-section">
      <div className="admin-toolbar">
        <h2>Testimonial ideas</h2>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null}
          onClick={() =>
            run("scan", async () => {
              const r = await adminApi.post<{ found: number; created: number }>("/lycie/testimonial-ideas/scan", {});
              setNotice(r.created ? `Found ${r.created} new idea${r.created === 1 ? "" : "s"}.` : "Nothing new — no fresh positive feedback fits yet.");
            })
          }
        >
          {busy === "scan" ? "Looking…" : "Look for new ideas"}
        </button>
      </div>
      <p className="text-muted">
        Lycie reads your approved reviews and visitor comments and picks out the warm, specific ones. Quotes are always the
        customer's own words — never rewritten — and nothing appears on the site until you publish it. Anonymous comments
        have no name, so only publish those if you're comfortable showing them. This also runs every Monday.
      </p>

      {notice && <p className="lycie-notice" role="status">{notice}</p>}
      {error && <p className="admin-error-text" role="alert">{error}</p>}
      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && data.length === 0 && (
        <div className="admin-empty-state">No ideas waiting. As customers leave good reviews, they'll show up here.</div>
      )}

      <ul className="lycie-log-list">
        {(data ?? []).map((idea) => {
          const isEditing = editing?.id === idea.id;
          return (
            <li key={idea.id}>
              <div className="lycie-log-list__head">
                <span className="admin-badge">{idea.source === "review" ? "Review" : "Visitor comment"}</span>
                {idea.rating !== null && <span aria-label={`${idea.rating} out of 5 stars`}>{"★".repeat(idea.rating)}{"☆".repeat(5 - idea.rating)}</span>}
                <span>Strength {Math.round(idea.score * 100)}%</span>
              </div>

              {isEditing ? (
                <div className="lycie-draft-form">
                  <FormField
                    id={`t-q-${idea.id}`}
                    as="textarea"
                    label="Quote (edit only to fix typos — keep the customer's meaning)"
                    rows={4}
                    maxLength={500}
                    value={editing.draft.quote}
                    onChange={(e) => setEditing({ id: idea.id, draft: { ...editing.draft, quote: e.target.value } })}
                  />
                  <FormField
                    id={`t-n-${idea.id}`}
                    label="Name shown"
                    maxLength={80}
                    value={editing.draft.authorName}
                    onChange={(e) => setEditing({ id: idea.id, draft: { ...editing.draft, authorName: e.target.value } })}
                  />
                  <FormField
                    id={`t-t-${idea.id}`}
                    label="Title (optional, e.g. Hilux buyer)"
                    maxLength={80}
                    value={editing.draft.authorTitle}
                    onChange={(e) => setEditing({ id: idea.id, draft: { ...editing.draft, authorTitle: e.target.value } })}
                  />
                  <FormField
                    id={`t-r-${idea.id}`}
                    as="select"
                    label="Stars"
                    value={editing.draft.rating}
                    onChange={(e) => setEditing({ id: idea.id, draft: { ...editing.draft, rating: e.target.value } })}
                  >
                    {[5, 4, 3].map((n) => (
                      <option key={n} value={n}>
                        {n} stars
                      </option>
                    ))}
                  </FormField>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy !== null}
                      onClick={() =>
                        run(
                          idea.id,
                          async () => {
                            await adminApi.post(`/lycie/testimonial-ideas/${idea.id}/publish`, {
                              quote: editing.draft.quote,
                              authorName: editing.draft.authorName,
                              authorTitle: editing.draft.authorTitle,
                              rating: Number(editing.draft.rating),
                            });
                            setEditing(null);
                          },
                          "Published to the homepage."
                        )
                      }
                    >
                      Publish
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <blockquote className="lycie-quote">“{idea.quote}”</blockquote>
                  <p className="text-muted">— {idea.authorName}</p>
                  <div className="admin-table__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy !== null}
                      onClick={() => run(idea.id, () => adminApi.post(`/lycie/testimonial-ideas/${idea.id}/publish`, {}), "Published to the homepage.")}
                    >
                      Publish as is
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        setEditing({
                          id: idea.id,
                          draft: { quote: idea.quote, authorName: idea.authorName, authorTitle: "", rating: String(idea.rating ?? 5) },
                        })
                      }
                    >
                      Edit & publish
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => run(idea.id, () => adminApi.post(`/lycie/testimonial-ideas/${idea.id}/dismiss`, {}))}>
                      Dismiss
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
