/**
 * Admin → Social Media (Owner/Manager).
 *  - Compose: write one post, pick Facebook and/or Instagram, then post now, schedule it, or save a
 *    draft. The AI helper can draft the wording. Can be pre-filled from a link such as
 *    /admin/social?text=…&image=…&link=… (used by "Post to socials" buttons elsewhere).
 *  - Inbox: comments on your posts and private messages, with a reply box for each.
 * Talks to /api/social (which talks to Meta's Graph API). Nothing is sent without pressing a button.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { ApiError } from "@/services/http";
import { adminApi } from "../adminApi";
import AiWriteButton from "../components/AiWriteButton";
import ImageUploader from "../components/ImageUploader";
import "../components/AdminLayout.css";
import { safeHttpUrl } from "@/utils/contactLinks";

type Tab = "compose" | "inbox";
type Channel = "facebook" | "instagram";

interface Status { facebook: boolean; instagram: boolean }
interface ChannelResult { ok: boolean; id?: string; error?: string }
interface Post {
  id: string;
  message: string;
  imageUrl: string | null;
  channels: Channel[];
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "PARTIAL" | "FAILED";
  results: Record<string, ChannelResult> | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
}
interface InboxItem {
  id: string;
  channel: Channel;
  kind: "comment" | "message";
  text: string;
  author: string;
  authorId?: string;
  createdAt: string;
  onPost?: string;
  link?: string;
}

const STATUS_LABEL: Record<Post["status"], string> = { DRAFT: "Draft", SCHEDULED: "Scheduled", PUBLISHED: "Posted", PARTIAL: "Partly posted", FAILED: "Failed" };

export default function AdminSocial() {
  const [tab, setTab] = useState<Tab>("compose");
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    adminApi.get<Status>("/social/status").then(setStatus).catch(() => setStatus({ facebook: false, instagram: false }));
  }, []);

  const connected = status && (status.facebook || status.instagram);
  return (
    <div>
      <h1>Social Media</h1>
      <p className="admin-page-intro">Post to the company's Facebook and Instagram, and answer what people say — without leaving the CMS.</p>

      {status && !connected && (
        <div className="form-status form-status--info" role="note">
          <strong>Not connected yet.</strong> You can write and save drafts now. To send posts and read replies, connect your Facebook Page (and Instagram) — the steps are in DEPLOYMENT.md under “Social media”.
        </div>
      )}

      <div className="admin-tabs" role="tablist" style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        {(["compose", "inbox"] as Tab[]).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"} onClick={() => setTab(id)}>
            {id === "compose" ? "Write a post" : "Comments & messages"}
          </button>
        ))}
      </div>
      {tab === "compose" && <Compose status={status} />}
      {tab === "inbox" && <Inbox connected={Boolean(connected)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ Compose */

function Compose({ status }: { status: Status | null }) {
  const [params] = useSearchParams();
  const [message, setMessage] = useState(params.get("text") ?? "");
  const [images, setImages] = useState<string[]>(params.get("image") ? [params.get("image") as string] : []);
  const [linkUrl, setLinkUrl] = useState(params.get("link") ?? "");
  const [channels, setChannels] = useState<Channel[]>(["facebook"]);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  const loadPosts = useCallback(() => {
    adminApi.get<Post[]>("/social/posts").then(setPosts).catch(() => undefined);
  }, []);
  useEffect(loadPosts, [loadPosts]);

  function toggle(channel: Channel) {
    setChannels((current) => (current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel]));
  }

  async function send(mode: "now" | "schedule" | "draft", event?: FormEvent) {
    event?.preventDefault();
    setNotice(null);
    if (!message.trim()) return setNotice({ kind: "error", text: "Write something first." });
    if (channels.length === 0) return setNotice({ kind: "error", text: "Pick at least one page to post to." });
    if (mode === "schedule" && !when) return setNotice({ kind: "error", text: "Choose when to post." });
    if (channels.includes("instagram") && images.length === 0 && mode !== "draft") return setNotice({ kind: "error", text: "Instagram posts need a picture. Add one, or untick Instagram." });

    setBusy(true);
    try {
      const post = await adminApi.post<Post>("/social/posts", {
        message,
        imageUrl: images[0] || undefined,
        linkUrl: linkUrl || undefined,
        channels,
        mode,
        scheduledFor: mode === "schedule" ? new Date(when).toISOString() : undefined,
      });
      const failed = post.results ? Object.entries(post.results).filter(([, r]) => !r.ok) : [];
      if (mode === "draft") setNotice({ kind: "success", text: "Draft saved." });
      else if (mode === "schedule") setNotice({ kind: "success", text: `Scheduled for ${new Date(when).toLocaleString()}.` });
      else if (post.status === "PUBLISHED") setNotice({ kind: "success", text: "Posted!" });
      else setNotice({ kind: "error", text: failed.map(([channel, r]) => `${channel}: ${r.error}`).join("  ") || "The post couldn't be sent." });
      if (mode !== "draft" && post.status === "PUBLISHED") { setMessage(""); setImages([]); setLinkUrl(""); }
      loadPosts();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't send the post." });
    } finally {
      setBusy(false);
    }
  }

  async function retry(id: string) {
    setNotice(null);
    try {
      await adminApi.post(`/social/posts/${id}/publish`, {});
      loadPosts();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof ApiError ? err.message : "Couldn't send the post." });
    }
  }

  async function remove(id: string) {
    await adminApi.delete(`/social/posts/${id}`).catch(() => undefined);
    loadPosts();
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <form className="form-card" onSubmit={(e) => send("now", e)} noValidate>
        <h2>New post</h2>
        {notice && <FormStatusBanner status={notice.kind} successMessage={notice.text} errorMessage={notice.text} />}
        <div className="form-grid">
          <FormField
            id="social-message"
            label="What do you want to say?"
            as="textarea"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            footer={<AiWriteButton kind="social-post" current={message} maxChars={350} hint="e.g. New 2020 Honda Fit just arrived, low mileage" onApply={setMessage} />}
          />
          <div className="form-field">
            <label>Picture (needed for Instagram)</label>
            <ImageUploader images={images} onChange={setImages} multiple={false} />
          </div>
          <FormField id="social-link" label="Link to include (optional)" type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />

          <fieldset className="site-content-fieldset">
            <legend>Post to</legend>
            {(["facebook", "instagram"] as Channel[]).map((channel) => (
              <label key={channel} className="form-check">
                <input type="checkbox" checked={channels.includes(channel)} onChange={() => toggle(channel)} />
                <span>{channel === "facebook" ? "Facebook Page" : "Instagram"}{status && !status[channel] ? " (not connected)" : ""}</span>
              </label>
            ))}
          </fieldset>

          <FormField id="social-when" label="Or schedule for a later time" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
        <div className="form-actions" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Post now"}</button>
          <button className="btn btn-secondary" type="button" onClick={() => send("schedule")} disabled={busy}>Schedule</button>
          <button className="btn btn-ghost" type="button" onClick={() => send("draft")} disabled={busy}>Save draft</button>
        </div>
      </form>

      <div className="form-card">
        <h2>Recent posts</h2>
        {posts.length === 0 && <p className="text-muted">Nothing yet.</p>}
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          {posts.map((post) => (
            <div key={post.id} style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
              <p style={{ overflowWrap: "anywhere" }}>{post.message}</p>
              <p className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>
                <strong>{STATUS_LABEL[post.status]}</strong> · {post.channels.join(", ")}
                {post.scheduledFor && post.status === "SCHEDULED" ? ` · goes out ${new Date(post.scheduledFor).toLocaleString()}` : ""}
                {" · "}{new Date(post.createdAt).toLocaleDateString()}
              </p>
              {post.results && Object.entries(post.results).filter(([, r]) => !r.ok).map(([channel, r]) => (
                <p key={channel} role="alert" style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>{channel}: {r.error}</p>
              ))}
              <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                {post.status !== "PUBLISHED" && <button className="link-button" onClick={() => retry(post.id)}>{post.status === "DRAFT" || post.status === "SCHEDULED" ? "Send now" : "Try again"}</button>}
                <button className="link-button" onClick={() => remove(post.id)}>Remove from this list</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Inbox */

function Inbox({ connected }: { connected: boolean }) {
  const [data, setData] = useState<{ items: InboxItem[]; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.get<{ items: InboxItem[]; errors: string[] }>("/social/inbox").then(setData).catch((err) => setData({ items: [], errors: [err instanceof ApiError ? err.message : "Couldn't load."] })).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (connected) load(); }, [connected, load]);

  if (!connected) return <p className="text-muted">Connect a Facebook Page or Instagram account to see comments and messages here.</p>;
  return (
    <div className="form-card">
      <div className="admin-toolbar">
        <h2>Comments &amp; messages</h2>
        <button className="btn btn-secondary" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>
      {data?.errors.map((error) => (<p key={error} role="alert" className="form-status form-status--error">{error}</p>))}
      {data && data.items.length === 0 && data.errors.length === 0 && <p className="text-muted">Nothing waiting for a reply.</p>}
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        {data?.items.map((item) => (<InboxRow key={`${item.kind}-${item.id}`} item={item} />))}
      </div>
    </div>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const [reply, setReply] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  // Instagram messages can't be answered through the API, so only comments and Facebook messages get a box.
  const canReply = item.kind === "comment" || item.channel === "facebook";

  async function send() {
    setState("sending");
    setError(null);
    try {
      await adminApi.post("/social/reply", { channel: item.channel, kind: item.kind, targetId: item.kind === "message" ? item.authorId ?? item.id : item.id, message: reply });
      setState("sent");
    } catch (err) {
      setState("idle");
      setError(err instanceof ApiError ? err.message : "Couldn't send the reply.");
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-3)" }}>
      <p className="text-muted" style={{ fontSize: "var(--fs-xs)" }}>
        {item.channel === "facebook" ? "Facebook" : "Instagram"} {item.kind} · <strong>{item.author}</strong> · {new Date(item.createdAt).toLocaleString()}
        {item.onPost ? ` · on “${item.onPost}”` : ""}
        {safeHttpUrl(item.link) && <> · <a href={safeHttpUrl(item.link)!} target="_blank" rel="noopener noreferrer">open</a></>}
      </p>
      <p style={{ overflowWrap: "anywhere" }}>{item.text}</p>
      {state === "sent" ? (
        <p className="text-muted">Reply sent.</p>
      ) : canReply ? (
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <input aria-label={`Reply to ${item.author}`} style={{ flex: 1, minWidth: 200, padding: "0.5rem 0.75rem", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)" }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
          <button className="btn btn-primary" onClick={send} disabled={!reply.trim() || state === "sending"}>{state === "sending" ? "Sending…" : "Reply"}</button>
        </div>
      ) : (
        <p className="text-muted">Reply to Instagram messages in the Instagram app.</p>
      )}
      {error && <p role="alert" style={{ color: "var(--color-error)", fontSize: "var(--fs-sm)" }}>{error}</p>}
    </div>
  );
}
