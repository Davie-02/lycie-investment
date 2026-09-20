import { useState } from "react";
import { adminApi } from "../adminApi";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ApiError } from "@/services/http";
import { useAsyncData } from "@/hooks/useAsyncData";
import { mailtoUrl, messageTemplate, telUrl, whatsappUrl, type RequestKind } from "@/utils/contactLinks";
import "./ContactCell.css";

type Method = "whatsapp" | "call" | "email" | "message";

export interface ContactRow {
  id: string;
  fullName: string;
  phone?: string | null;
  email: string;
  customerId?: string | null;
  preferredContact?: string | null;
}

interface ContactCellProps {
  kind: RequestKind;
  row: ContactRow;
  /** Reads naturally after "about": e.g. "the Toyota Hilux 2022". */
  topic: string;
  onContacted?: () => void;
}

interface LogEntry {
  id: string;
  method: Method;
  note: string | null;
  adminName: string;
  createdAt: string;
}

const METHOD_LABEL: Record<Method, string> = {
  whatsapp: "WhatsApp",
  call: "Phone call",
  email: "Email",
  message: "Lycie profile message",
};

/**
 * Everything needed to answer a customer, right where their request is listed.
 * One tap opens their WhatsApp / dialer / a composer for email or a message in
 * their Lycie profile. The customer's own preference is starred, and every
 * contact is recorded so the team can see who reached out and how.
 */
export default function ContactCell({ kind, row, topic, onContacted }: ContactCellProps) {
  const { currentUser } = useAdminAuth();
  const canContact = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";
  const [dialog, setDialog] = useState<"email" | "message" | "history" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = messageTemplate(kind, row.fullName, topic, currentUser?.name);
  const preferred = row.preferredContact as Method | null | undefined;
  const wa = row.phone ? whatsappUrl(row.phone, template.body) : null;
  const tel = row.phone ? telUrl(row.phone) : null;

  async function record(method: Method, note?: string) {
    setError(null);
    try {
      await adminApi.post(`/contact-admin/${kind}/${row.id}/log`, { method, note });
      onContacted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't record that contact.");
    }
  }

  const star = (method: Method) => (preferred === method ? " ★" : "");
  const cls = (method: Method) => (preferred === method ? "contact-btn contact-btn--preferred" : "contact-btn");

  return (
    <div className="contact-cell">
      <div className="contact-cell__details">
        {row.phone && <span className="mono">{row.phone}</span>}
        <span className="mono">{row.email}</span>
      </div>
      {preferred && (
        <span className="contact-cell__pref">
          Prefers: <strong>{METHOD_LABEL[preferred]}</strong>
        </span>
      )}

      {canContact && (
        <div className="contact-cell__actions">
          {wa ? (
            <a className={cls("whatsapp")} href={wa} target="_blank" rel="noopener noreferrer" onClick={() => void record("whatsapp")}>
              WhatsApp{star("whatsapp")}
            </a>
          ) : null}
          {tel ? (
            <a className={cls("call")} href={tel} onClick={() => void record("call")}>
              Call{star("call")}
            </a>
          ) : null}
          <button type="button" className={cls("email")} onClick={() => setDialog("email")}>
            Email{star("email")}
          </button>
          <button
            type="button"
            className={cls("message")}
            onClick={() => setDialog("message")}
            disabled={!row.customerId}
            title={row.customerId ? "Send a message to their Lycie profile" : "They weren't signed in, so they have no profile to message"}
          >
            Profile message{star("message")}
          </button>
          <button type="button" className="contact-btn contact-btn--quiet" onClick={() => setDialog("history")}>
            History
          </button>
        </div>
      )}
      {error && <span className="admin-error-text" role="alert">{error}</span>}

      {dialog === "history" && <HistoryDialog kind={kind} row={row} onClose={() => setDialog(null)} onLog={record} />}
      {(dialog === "email" || dialog === "message") && (
        <ComposeDialog
          mode={dialog}
          kind={kind}
          row={row}
          template={template}
          onClose={() => setDialog(null)}
          onSent={() => {
            setDialog(null);
            onContacted?.();
          }}
        />
      )}
    </div>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="contact-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="contact-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <div className="contact-dialog__head">
          <h3>{title}</h3>
          <button type="button" className="contact-dialog__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ComposeDialog(props: {
  mode: "email" | "message";
  kind: RequestKind;
  row: ContactRow;
  template: { subject: string; body: string };
  onClose: () => void;
  onSent: () => void;
}) {
  const { mode, kind, row, template, onClose, onSent } = props;
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.post(`/contact-admin/${kind}/${row.id}/${mode}`, { subject, body });
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay title={mode === "email" ? `Email ${row.fullName}` : `Message ${row.fullName} in their Lycie profile`} onClose={onClose}>
      <p className="text-muted contact-dialog__to">
        {mode === "email" ? `To: ${row.email}` : "They'll see it under Messages in their account, and get an email to say it's waiting."}
      </p>
      <label className="contact-dialog__field">
        <span>Subject</span>
        <input value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="contact-dialog__field">
        <span>Message</span>
        <textarea rows={9} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
      </label>
      {error && <p className="admin-error-text" role="alert">{error}</p>}
      <div className="contact-dialog__actions">
        <button type="button" className="btn btn-primary" disabled={busy || subject.trim().length < 2 || body.trim().length < 2} onClick={send}>
          {busy ? "Sending…" : "Send"}
        </button>
        {mode === "email" && (
          <a className="btn btn-secondary" href={mailtoUrl(row.email, subject, body)} onClick={() => void adminApi.post(`/contact-admin/${kind}/${row.id}/log`, { method: "email", note: "Opened in mail app" }).catch(() => undefined)}>
            Open in my mail app
          </a>
        )}
        <button type="button" className="btn-ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Overlay>
  );
}

function HistoryDialog({ kind, row, onClose, onLog }: { kind: RequestKind; row: ContactRow; onClose: () => void; onLog: (m: Method, note?: string) => Promise<void> }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading } = useAsyncData(
    () => adminApi.get<{ logs: LogEntry[] }>(`/contact-admin/${kind}/${row.id}`),
    [refreshKey]
  );
  const [method, setMethod] = useState<Method>("call");
  const [note, setNote] = useState("");

  return (
    <Overlay title={`Contact history — ${row.fullName}`} onClose={onClose}>
      <div className="contact-dialog__log-form">
        <select value={method} onChange={(e) => setMethod(e.target.value as Method)} aria-label="How you got in touch">
          {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="What was said or agreed (optional)" />
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            await onLog(method, note);
            setNote("");
            setRefreshKey((k) => k + 1);
          }}
        >
          Log it
        </button>
      </div>
      {isLoading && !data && <p className="text-muted">Loading…</p>}
      {data && data.logs.length === 0 && <p className="text-muted">Nobody has contacted them yet.</p>}
      <ul className="contact-dialog__history">
        {(data?.logs ?? []).map((log) => (
          <li key={log.id}>
            <strong>{METHOD_LABEL[log.method]}</strong> · {log.adminName} ·{" "}
            <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
            {log.note && <div className="text-muted">{log.note}</div>}
          </li>
        ))}
      </ul>
    </Overlay>
  );
}
