import { useState } from "react";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import "./AiWriteButton.css";

export type WriterKind =
  | "vehicle-description"
  | "blog-title"
  | "blog-excerpt"
  | "blog-body"
  | "faq-answer"
  | "notice"
  | "seo-description"
  | "site-text";

type Tone = "friendly" | "professional" | "persuasive" | "concise";

interface AiWriteButtonProps {
  kind: WriterKind;
  /** What's in the field right now — offered to the AI as text to improve. */
  current?: string;
  /** Known facts (one per line) — e.g. the vehicle's specifications. */
  facts?: () => string;
  /** Pre-filled suggestion for the brief box. */
  hint?: string;
  maxChars?: number;
  defaultTone?: Tone;
  onApply: (text: string) => void;
}

/**
 * "Write with AI" for any text box. Nothing is saved or published by it: it
 * fills the box with a draft (built from the company's own data plus what you
 * tell it), which you can edit or discard before saving the page as usual.
 */
export default function AiWriteButton({ kind, current, facts, hint, maxChars, defaultTone = "friendly", onApply }: AiWriteButtonProps) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState(hint ?? "");
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(improve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.post<{ text: string }>("/lycie/write", {
        kind,
        tone,
        brief: brief.trim() || undefined,
        facts: facts?.() || undefined,
        current: improve && current?.trim() ? current : undefined,
        maxChars,
      });
      setDraft(result.text);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The AI writer couldn't be reached.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="ai-write__open" onClick={() => setOpen(true)}>
        <span aria-hidden="true">✨</span> Write with AI
      </button>
    );
  }

  return (
    <div className="ai-write" role="group" aria-label="Write with AI">
      <div className="ai-write__row">
        <label className="ai-write__field">
          <span>What should it say? (optional)</span>
          <textarea
            rows={2}
            maxLength={800}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Mention it's fuel efficient and ideal for city driving"
          />
        </label>
        <label className="ai-write__tone">
          <span>Tone</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="persuasive">Persuasive</option>
            <option value="concise">Concise</option>
          </select>
        </label>
      </div>

      <div className="ai-write__actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => generate(false)}>
          {busy ? "Writing…" : draft ? "Write again" : "Write it"}
        </button>
        {current?.trim() && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => generate(true)}>
            Improve what's there
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      {error && <p className="admin-error-text" role="alert">{error}</p>}

      {draft && (
        <div className="ai-write__result">
          <label>
            <span>Draft — edit freely before using it</span>
            <textarea rows={Math.min(12, Math.max(4, Math.ceil(draft.length / 90)))} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <div className="ai-write__actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onApply(draft);
                setOpen(false);
                setDraft("");
              }}
            >
              Use this text
            </button>
            <span className="text-muted">AI can make mistakes — check names, prices and details before saving.</span>
          </div>
        </div>
      )}
    </div>
  );
}
