import { useCallback, useState, type FormEvent } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import LycieDocuments from "../components/LycieDocuments";
import LycieFaqSuggestions from "../components/LycieFaqSuggestions";
import LycieVisitorMessages from "../components/LycieVisitorMessages";
import type { KnowledgeCategory, KnowledgeEntry, KnowledgeList, LycieAnalytics, LycieLogEntry } from "@/types/lycie";
import "../components/AdminLayout.css";
import "../components/AdminInsights.css";
import "./AdminLycie.css";

type Tab = "knowledge" | "conversations" | "faq" | "messages";

const TAB_LABELS: Record<Tab, string> = {
  knowledge: "Knowledge",
  conversations: "Conversations & gaps",
  faq: "FAQ suggestions",
  messages: "Visitor messages",
};

const CATEGORIES: Array<{ value: KnowledgeCategory; label: string }> = [
  { value: "faq", label: "FAQ" },
  { value: "policy", label: "Policy" },
  { value: "process", label: "Process" },
  { value: "pricing", label: "Pricing" },
  { value: "other", label: "Other" },
];

interface Draft {
  id: string | null;
  title: string;
  category: KnowledgeCategory;
  content: string;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = { id: null, title: "", category: "faq", content: "", isActive: true };

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminLycie() {
  const [tab, setTab] = useState<Tab>("knowledge");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="insights">
      <div className="admin-toolbar">
        <h1>Lycie assistant</h1>
      </div>
      <p className="admin-page-intro">
        Lycie answers customers using your live vehicles, hire fleet, FAQ and site content, plus the notes you add
        here. Add anything she should know — policies, deposits, timelines, opening hours changes. She never invents
        prices or availability; when she doesn't know, she says so and it shows up under “Gaps” for you to fill.
      </p>

      <div className="insights-filters" role="tablist" aria-label="Lycie sections">
        {(Object.keys(TAB_LABELS) as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={tab === value ? "insights-filter insights-filter--active" : "insights-filter"}
            onClick={() => setTab(value)}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </div>

      {actionError && <p className="admin-error-text" role="alert">{actionError}</p>}

      {tab === "faq" && <LycieFaqSuggestions />}
      {tab === "messages" && <LycieVisitorMessages />}

      {tab === "knowledge" && (
        <KnowledgeTab
          draft={draft}
          setDraft={setDraft}
          refreshKey={refreshKey}
          refresh={refresh}
          setActionError={setActionError}
        />
      )}

      {tab === "conversations" && (
        <ConversationsTab
          refreshKey={refreshKey}
          onAddToKnowledge={(log) => {
            setDraft({ ...EMPTY_DRAFT, title: log.question.slice(0, 120) });
            setTab("knowledge");
          }}
        />
      )}
    </div>
  );
}

interface KnowledgeTabProps {
  draft: Draft | null;
  setDraft: (draft: Draft | null) => void;
  refreshKey: number;
  refresh: () => void;
  setActionError: (message: string | null) => void;
}

function KnowledgeTab({ draft, setDraft, refreshKey, refresh, setActionError }: KnowledgeTabProps) {
  const { data, isLoading, error } = useAsyncData(() => adminApi.get<KnowledgeList>("/lycie/knowledge"), [refreshKey]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      setFormError("A title and the content are both required.");
      return;
    }
    setFormError(null);
    setIsSaving(true);
    const payload = {
      title: draft.title.trim(),
      category: draft.category,
      content: draft.content.trim(),
      isActive: draft.isActive,
    };
    try {
      if (draft.id) await adminApi.patch(`/lycie/knowledge/${draft.id}`, payload);
      else await adminApi.post("/lycie/knowledge", payload);
      setDraft(null);
      refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(entry: KnowledgeEntry) {
    setActionError(null);
    try {
      await adminApi.patch(`/lycie/knowledge/${entry.id}`, { isActive: !entry.isActive });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update.");
    }
  }

  async function remove(entry: KnowledgeEntry) {
    if (!window.confirm(`Delete “${entry.title}”? Lycie will stop using it.`)) return;
    setActionError(null);
    try {
      await adminApi.delete(`/lycie/knowledge/${entry.id}`);
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  if (draft) {
    return (
      <form className="form-card" onSubmit={save} noValidate>
        <h2>{draft.id ? "Edit knowledge" : "Add knowledge"}</h2>
        {formError && <FormStatusBanner status="error" successMessage="" errorMessage={formError} />}
        <div className="form-grid form-grid--2col">
          <FormField
            id="k-title"
            label="Title / question"
            required
            maxLength={120}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="e.g. Do you offer financing?"
          />
          <FormField
            id="k-category"
            as="select"
            label="Category"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as KnowledgeCategory })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </FormField>
          <FormField
            id="k-content"
            as="textarea"
            label={`Answer / details (${draft.content.length}/2000)`}
            required
            rows={7}
            maxLength={2000}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            placeholder="Write it the way you'd explain it to a customer. Include exact figures and conditions."
            wrapperClassName="form-grid__full"
          />
        </div>
        <label className="lycie-check">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          />
          Active — Lycie uses this in her answers
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDraft(null)} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const pct = data ? Math.min(100, Math.round((data.activeChars / data.budgetChars) * 100)) : 0;

  return (
    <div>
      <LycieDocuments onChanged={refresh} />

      <div className="admin-toolbar">
        <h2>Knowledge notes</h2>
        <button type="button" className="btn btn-primary" onClick={() => setDraft(EMPTY_DRAFT)}>
          Add knowledge
        </button>
      </div>

      {data && (
        <div className="lycie-budget">
          <div className="lycie-budget__bar" role="img" aria-label={`${pct}% of Lycie's knowledge space used`}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="text-muted">
            {data.activeChars.toLocaleString()} of {data.budgetChars.toLocaleString()} characters used by active notes.
            {data.activeChars > data.budgetChars
              ? " Over the limit — Lycie now picks the most relevant notes for each question, so keep notes focused."
              : ""}{" "}
            Your {data.faqCount} FAQ entr{data.faqCount === 1 ? "y is" : "ies are"} included automatically.
          </p>
        </div>
      )}

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p className="text-muted" role="alert">Unable to load knowledge notes.</p>}
      {data && data.items.length === 0 && (
        <div className="admin-empty-state">
          No notes yet. Add policies, deposit rules, delivery timelines or anything customers keep asking.
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{entry.title}</strong>
                    <p className="lycie-snippet">{entry.content}</p>
                  </td>
                  <td>{CATEGORIES.find((c) => c.value === entry.category)?.label ?? entry.category}</td>
                  <td>
                    <span className={entry.isActive ? "admin-badge admin-badge--available" : "admin-badge admin-badge--sold"}>
                      {entry.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td>{formatWhen(entry.updatedAt)}</td>
                  <td>
                    <div className="admin-table__actions">
                      <button type="button" className="btn-ghost" onClick={() => setDraft({ ...entry })}>
                        Edit
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => toggleActive(entry)}>
                        {entry.isActive ? "Pause" : "Activate"}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => remove(entry)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConversationsTab({
  refreshKey,
  onAddToKnowledge,
}: {
  refreshKey: number;
  onAddToKnowledge: (log: LycieLogEntry) => void;
}) {
  const { data, isLoading, error } = useAsyncData(
    () => adminApi.get<LycieAnalytics>("/lycie/analytics?days=30"),
    [refreshKey]
  );

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (error || !data) return <p className="text-muted" role="alert">Unable to load conversations.</p>;

  const answered = (data.outcomes.answered ?? 0) + (data.outcomes.no_info ?? 0);
  const rated = data.helpful + data.notHelpful;

  return (
    <div>
      <div className="insights-kpis">
        <div className="insights-kpi">
          <div className="insights-kpi__label">Questions (30 days)</div>
          <div className="insights-kpi__value">{data.total}</div>
        </div>
        <div className="insights-kpi">
          <div className="insights-kpi__label">Answered by AI</div>
          <div className="insights-kpi__value">{answered}</div>
          <div className="insights-kpi__note">{data.outcomes.unavailable ?? 0} handed to the contact fallback</div>
        </div>
        <div className="insights-kpi">
          <div className="insights-kpi__label">Lycie didn't know</div>
          <div className="insights-kpi__value">{data.outcomes.no_info ?? 0}</div>
          <div className="insights-kpi__note">Add notes below to close these gaps</div>
        </div>
        <div className="insights-kpi">
          <div className="insights-kpi__label">Helpful votes</div>
          <div className="insights-kpi__value">{data.helpful}</div>
          <div className="insights-kpi__note">{rated ? `${Math.round((data.helpful / rated) * 100)}% of ${rated} rated` : "No ratings yet"}</div>
        </div>
        <div className="insights-kpi">
          <div className="insights-kpi__label">Not-helpful votes</div>
          <div className="insights-kpi__value">{data.notHelpful}</div>
        </div>
      </div>

      <section className="insights-section">
        <h2>Gaps to fill</h2>
        <p className="text-muted">
          Questions Lycie couldn't answer, or that customers marked unhelpful. Personal details are removed before
          anything is stored.
        </p>
        {data.gaps.length === 0 ? (
          <div className="admin-empty-state">No gaps in the last 30 days.</div>
        ) : (
          <ul className="lycie-log-list">
            {data.gaps.map((log) => (
              <li key={log.id}>
                <div className="lycie-log-list__head">
                  <span className="admin-badge admin-badge--reserved">
                    {log.outcome === "no_info" ? "Didn't know" : "Marked unhelpful"}
                  </span>
                  <time dateTime={log.createdAt}>{formatWhen(log.createdAt)}</time>
                </div>
                <p className="lycie-log-list__q">{log.question}</p>
                <p className="text-muted lycie-log-list__a">{log.answer}</p>
                <button type="button" className="btn-ghost" onClick={() => onAddToKnowledge(log)}>
                  Add to knowledge →
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="insights-section">
        <h2>Recent conversations</h2>
        {data.recent.length === 0 ? (
          <div className="admin-empty-state">No conversations yet.</div>
        ) : (
          <ul className="lycie-log-list">
            {data.recent.map((log) => (
              <li key={log.id}>
                <div className="lycie-log-list__head">
                  <span className="admin-badge">{log.outcome.replace("_", " ")}</span>
                  {log.helpful !== null && <span>{log.helpful ? "👍 helpful" : "👎 not helpful"}</span>}
                  <time dateTime={log.createdAt}>{formatWhen(log.createdAt)}</time>
                </div>
                <p className="lycie-log-list__q">{log.question}</p>
                <p className="text-muted lycie-log-list__a">{log.answer}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
