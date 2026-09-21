/**
 * Admin panel for Lycie's FAQ suggestions: the most-asked topics of the last 30 days and
 * the draft answers Lycie wrote from company data. An admin edits then publishes or
 * rejects each; nothing is published automatically. Uses /api/lycie/suggestions and
 * /top-questions.
 */
import { useState } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import FormField from "@/components/forms/FormField";
import { ApiError } from "@/services/http";
import type { FaqSuggestion, GenerateResult, TopTopic } from "@/types/lycie";

interface Draft {
  question: string;
  answer: string;
  category: string;
}

function summarise(result: GenerateResult): string {
  if (result.aiUnavailable) {
    return "Lycie's AI is unavailable right now (quota or outage), so some topics were left for later. Try again shortly.";
  }
  if (result.topics === 0) return "Not enough repeated questions yet — topics appear once a question is asked at least twice.";
  if (result.created === 0 && result.updated === 0) return "Nothing new: every popular topic already has an FAQ or a draft.";
  return `Done — ${result.created} new draft${result.created === 1 ? "" : "s"}, ${result.updated} refreshed.`;
}

export default function LycieFaqSuggestions() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topics = useAsyncData(() => adminApi.get<TopTopic[]>("/lycie/top-questions"), [refreshKey]);
  const drafts = useAsyncData(() => adminApi.get<FaqSuggestion[]>("/lycie/suggestions"), [refreshKey]);
  const refresh = () => setRefreshKey((k) => k + 1);

  async function run<T>(key: string, action: () => Promise<T>, done?: (value: T) => string) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const value = await action();
      if (done) setNotice(done(value));
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const maxCount = Math.max(1, ...(topics.data ?? []).map((t) => t.count));

  return (
    <div>
      <section className="insights-section">
        <div className="admin-toolbar">
          <h2>Most-asked topics (last 30 days)</h2>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() => run("generate", () => adminApi.post<GenerateResult>("/lycie/suggestions/generate", {}), summarise)}
          >
            {busy === "generate" ? "Lycie is reading questions…" : "Analyse & draft FAQs"}
          </button>
        </div>
        <p className="text-muted">
          Questions from the chat and the FAQ page's “Ask us” form are grouped by topic. Lycie drafts an answer from
          your company data for popular topics with no FAQ yet — nothing is published until you approve it. This also
          runs automatically every Monday.
        </p>

        {notice && <p className="lycie-notice" role="status">{notice}</p>}
        {error && <p className="admin-error-text" role="alert">{error}</p>}

        {topics.isLoading && <p className="text-muted">Loading…</p>}
        {topics.data && topics.data.length === 0 && (
          <div className="admin-empty-state">No questions yet. They'll appear here as visitors chat with Lycie.</div>
        )}
        {topics.data && topics.data.length > 0 && (
          <ul className="lycie-topics">
            {topics.data.map((topic) => (
              <li key={topic.representative}>
                <div className="lycie-topics__row" title={topic.samples.join("\n")}>
                  <span className="lycie-topics__label">{topic.representative}</span>
                  <div className="hbars__track">
                    <div className="hbars__fill" style={{ width: `${(topic.count / maxCount) * 100}%` }} />
                  </div>
                  <b className="mono">{topic.count}×</b>
                  <span className={topic.covered ? "admin-badge admin-badge--available" : "admin-badge admin-badge--reserved"}>
                    {topic.covered ? "Covered" : "Not in FAQ"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="insights-section">
        <h2>Drafts waiting for your review</h2>
        {drafts.isLoading && <p className="text-muted">Loading…</p>}
        {drafts.data && drafts.data.length === 0 && (
          <div className="admin-empty-state">No drafts waiting. Run the analysis to create some.</div>
        )}

        <ul className="lycie-log-list">
          {(drafts.data ?? []).map((s) => {
            const isEditing = editing?.id === s.id;
            return (
              <li key={s.id}>
                <div className="lycie-log-list__head">
                  <span className="admin-badge">Asked {s.askCount}×</span>
                  {s.needsInput && <span className="admin-badge admin-badge--overdue">Needs your input</span>}
                </div>

                {isEditing ? (
                  <div className="lycie-draft-form">
                    <FormField
                      id={`d-q-${s.id}`}
                      label="Question"
                      maxLength={200}
                      value={editing.draft.question}
                      onChange={(e) => setEditing({ id: s.id, draft: { ...editing.draft, question: e.target.value } })}
                    />
                    <FormField
                      id={`d-a-${s.id}`}
                      as="textarea"
                      label="Answer"
                      rows={5}
                      maxLength={1500}
                      value={editing.draft.answer}
                      onChange={(e) => setEditing({ id: s.id, draft: { ...editing.draft, answer: e.target.value } })}
                    />
                    <FormField
                      id={`d-c-${s.id}`}
                      label="FAQ category (optional)"
                      maxLength={60}
                      value={editing.draft.category}
                      onChange={(e) => setEditing({ id: s.id, draft: { ...editing.draft, category: e.target.value } })}
                      placeholder="e.g. Hire, Import, General"
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy !== null || !editing.draft.answer.trim() || !editing.draft.question.trim()}
                        onClick={() =>
                          run(
                            s.id,
                            () => adminApi.post(`/lycie/suggestions/${s.id}/publish`, editing.draft),
                            () => "Published to the FAQ page — Lycie will use it straight away."
                          ).then(() => setEditing(null))
                        }
                      >
                        Publish to FAQ
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          run(s.id, () => adminApi.patch(`/lycie/suggestions/${s.id}`, editing.draft)).then(() =>
                            setEditing(null)
                          )
                        }
                      >
                        Save draft
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="lycie-log-list__q">{s.question}</p>
                    <p className="lycie-draft-answer">{s.answer}</p>
                    <details className="lycie-samples">
                      <summary>What people actually asked ({s.samples.length})</summary>
                      <ul>
                        {s.samples.map((sample) => (
                          <li key={sample}>{sample}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="admin-table__actions">
                      {!s.needsInput && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy !== null}
                          onClick={() =>
                            run(
                              s.id,
                              () => adminApi.post(`/lycie/suggestions/${s.id}/publish`, {}),
                              () => "Published to the FAQ page — Lycie will use it straight away."
                            )
                          }
                        >
                          Approve & publish
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          setEditing({
                            id: s.id,
                            draft: { question: s.question, answer: s.needsInput ? "" : s.answer, category: s.category ?? "" },
                          })
                        }
                      >
                        {s.needsInput ? "Write the answer" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy !== null}
                        onClick={() => run(s.id, () => adminApi.post(`/lycie/suggestions/${s.id}/reject`, {}))}
                      >
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
