import { useState } from "react";
import "./ShareButtons.css";

interface ShareButtonsProps {
  /** Address to share. Defaults to the page the visitor is on. */
  url?: string;
  /** What the shared message says, e.g. "Toyota Hilux 2022 — Lycie Investments". */
  text: string;
}

/**
 * Lets visitors pass a vehicle or post on: WhatsApp and Facebook (the most-used in Malawi), X,
 * copy-link, and the phone's own share sheet when the browser offers one. Plain links — no
 * third-party scripts are loaded, so it costs nothing in page speed or visitor privacy.
 */
export default function ShareButtons({ url, text }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const target = url ?? window.location.href;
  const encodedUrl = encodeURIComponent(target);
  const encodedText = encodeURIComponent(text);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the other buttons still work.
    }
  }

  return (
    <div className="share" role="group" aria-label="Share">
      <span className="share__label">Share</span>
      <a className="share__btn" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${target}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className="share__btn" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a className="share__btn" href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noopener noreferrer">X</a>
      <button type="button" className="share__btn" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
      {canNativeShare && (
        <button type="button" className="share__btn" onClick={() => void navigator.share({ title: text, url: target }).catch(() => undefined)}>More…</button>
      )}
    </div>
  );
}
