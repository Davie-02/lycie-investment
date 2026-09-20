import { useRef, useState, type DragEvent } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import type { KnowledgeDocument, KnowledgeDocumentDetail } from "@/types/lycie";

const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp";

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/**
 * Teach Lycie by uploading files. Their text becomes part of what she knows —
 * PDF/Word/text are read on our own server; images are read by Google's AI.
 */
export default function LycieDocuments({ onChanged }: { onChanged: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: documents, isLoading } = useAsyncData(() => adminApi.get<KnowledgeDocument[]>("/lycie/documents"), [refreshKey]);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ ok: boolean; text: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState<KnowledgeDocumentDetail | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => {
    setRefreshKey((k) => k + 1);
    onChanged();
  };

  async function upload(files: File[]) {
    setResults([]);
    for (const file of files) {
      setBusy(file.name);
      try {
        const doc = await adminApi.uploadFile<{ fileName: string; charCount: number; truncated: boolean; _count: { entries: number } }>(
          "/lycie/documents",
          file
        );
        setResults((prev) => [
          ...prev,
          {
            ok: true,
            text: `${doc.fileName}: learned ${doc.charCount.toLocaleString()} characters in ${doc._count.entries} section${doc._count.entries === 1 ? "" : "s"}${doc.truncated ? " (very long — only the first part was kept)" : ""}.`,
          },
        ]);
      } catch (err) {
        setResults((prev) => [...prev, { ok: false, text: `${file.name}: ${err instanceof ApiError ? err.message : "Upload failed."}` }]);
      }
    }
    setBusy(null);
    refresh();
  }

  async function toggle(doc: KnowledgeDocument) {
    await adminApi.patch(`/lycie/documents/${doc.id}`, { isActive: !doc.isActive }).catch(() => undefined);
    refresh();
  }

  async function remove(doc: KnowledgeDocument) {
    if (!window.confirm(`Remove “${doc.fileName}”? Lycie will forget everything she learned from it.`)) return;
    await adminApi.delete(`/lycie/documents/${doc.id}`).catch(() => undefined);
    if (open?.id === doc.id) setOpen(null);
    refresh();
  }

  async function view(doc: KnowledgeDocument) {
    if (open?.id === doc.id) return setOpen(null);
    setOpen(await adminApi.get<KnowledgeDocumentDetail>(`/lycie/documents/${doc.id}`).catch(() => null));
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void upload([...event.dataTransfer.files]);
  };

  return (
    <section className="insights-section lycie-docs">
      <h2>Documents Lycie has learned from</h2>
      <p className="text-muted">
        Upload price lists, terms, brochures, policies, process guides or notices. PDF, Word (.docx), text, Markdown, CSV
        and images (PNG/JPG/WebP) up to 8&nbsp;MB. PDF, Word and text files are read on our own server; images are read
        by Google's AI, so don't upload pictures containing customers' personal details.
      </p>

      <div
        className={dragging ? "lycie-drop lycie-drop--active" : "lycie-drop"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload([...e.target.files]);
            e.target.value = "";
          }}
        />
        {busy ? (
          <p role="status">Reading “{busy}”…</p>
        ) : (
          <>
            <p>Drag files here, or</p>
            <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
              Choose files
            </button>
          </>
        )}
      </div>

      {results.length > 0 && (
        <ul className="lycie-upload-results" aria-live="polite">
          {results.map((r, i) => (
            <li key={i} className={r.ok ? "lycie-upload-results__ok" : "lycie-upload-results__err"}>
              {r.ok ? "✓ " : "✕ "}
              {r.text}
            </li>
          ))}
        </ul>
      )}

      {isLoading && !documents && <p className="text-muted">Loading…</p>}
      {documents && documents.length === 0 && <div className="admin-empty-state">No documents yet.</div>}

      {documents && documents.length > 0 && (
        <ul className="lycie-log-list">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div className="lycie-log-list__head">
                <strong>{doc.fileName}</strong>
                <span className={doc.isActive ? "admin-badge admin-badge--available" : "admin-badge admin-badge--sold"}>
                  {doc.isActive ? "Active" : "Paused"}
                </span>
                <span>
                  {size(doc.sizeBytes)} · {doc.charCount.toLocaleString()} chars · {doc._count.entries} section
                  {doc._count.entries === 1 ? "" : "s"}
                </span>
                <time dateTime={doc.createdAt}>{new Date(doc.createdAt).toLocaleDateString()}</time>
              </div>
              <div className="admin-table__actions">
                <button type="button" className="btn-ghost" onClick={() => view(doc)}>
                  {open?.id === doc.id ? "Hide text" : "See what she learned"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => toggle(doc)}>
                  {doc.isActive ? "Pause" : "Activate"}
                </button>
                <button type="button" className="btn-ghost lycie-danger" onClick={() => remove(doc)}>
                  Remove
                </button>
              </div>
              {open?.id === doc.id && (
                <div className="lycie-doc-sections">
                  {open.entries.map((entry) => (
                    <details key={entry.id}>
                      <summary>{entry.title}</summary>
                      <p>{entry.content}</p>
                    </details>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
