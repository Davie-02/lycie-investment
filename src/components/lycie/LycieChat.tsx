import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { getLycieStatus, sendLycieFeedback, streamLycieMessage } from "@/services/lycie.service";
import RichText from "./RichText";
import Img from "@/components/common/Img";

import type { LycieVehicleCard } from "@/types/lycie";
import "./LycieChat.css";
import Price from "@/components/common/Price";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  vehicles?: LycieVehicleCard[];
  logId?: string | null;
  feedback?: "up" | "down";
}

const STORAGE_KEY = "lycie_chat_v1";
const MAX_CHARS = 500;
const MAX_STORED = 24;
const SUGGESTIONS = [
  "What vehicles do you have available?",
  "How does importing a car work?",
  "How much is it to hire a vehicle?",
  "What should I check when buying a used car?",
];

function loadMessages(): ChatMessage[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" strokeLinejoin="round" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" strokeLinejoin="round" />
    </svg>
  );
}

export default function LycieChat() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const nextId = useRef(messages.reduce((max, m) => Math.max(max, m.id), 0) + 1);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // The widget only appears when the server has an AI key configured.
  useEffect(() => {
    let cancelled = false;
    getLycieStatus()
      .then((status) => !cancelled && setEnabled(status.enabled))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      // Storage unavailable — the chat still works, it just won't survive a reload.
    }
  }, [messages]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, isSending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || isSending) return;

    const history = messages.slice(-6).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      text: m.text.slice(0, 800),
    }));
    const userMessage: ChatMessage = { id: nextId.current++, role: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    // The reply appears word by word: the message is created on the first piece of text.
    const replyId = nextId.current++;
    let started = false;
    const setReply = (patch: Partial<ChatMessage>, append?: string) =>
      setMessages((prev) => {
        if (!prev.some((m) => m.id === replyId)) {
          return [...prev, { id: replyId, role: "assistant", text: append ?? "", ...patch }];
        }
        return prev.map((m) => (m.id === replyId ? { ...m, ...patch, text: append ? m.text + append : (patch.text ?? m.text) } : m));
      });

    try {
      const response = await streamLycieMessage(text, history, {
        onDelta: (delta) => {
          started = true;
          setReply({}, delta);
        },
      });
      // The final text is the tidied version — it replaces what streamed in.
      setReply({ text: response.reply, vehicles: response.vehicles, logId: response.logId });
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Something went wrong.";
      if (started) {
        // Some of the answer is already on screen — keep it and say it was cut short.
        setReply({}, "\n\n(The answer was cut short — please ask again.)");
      } else {
        setReply({ text: `Sorry — ${message} Please try again in a moment.` });
      }
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  function rate(message: ChatMessage, feedback: "up" | "down") {
    if (!message.logId || message.feedback) return;
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, feedback } : m)));
    void sendLycieFeedback(message.logId, feedback === "up").catch(() => undefined);
  }

  function clearChat() {
    setMessages([]);
    inputRef.current?.focus();
  }

  if (!enabled) return null;

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          className="lycie-launcher"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <SparkIcon />
          <span className="lycie-launcher__label">Ask Lycie</span>
        </button>
      )}

      {open && (
        <section className="lycie-panel" role="dialog" aria-label="Chat with Lycie, our virtual assistant">
          <header className="lycie-panel__header">
            <span className="lycie-panel__avatar" aria-hidden="true">
              <SparkIcon />
            </span>
            <div className="lycie-panel__title">
              <strong>Lycie</strong>
              <span>Virtual assistant · Lycie Investments</span>
            </div>
            {messages.length > 0 && (
              <button type="button" className="lycie-panel__action" onClick={clearChat}>
                New chat
              </button>
            )}
            <button type="button" className="lycie-panel__close" onClick={close} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="lycie-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 && (
              <div className="lycie-welcome">
                <p>
                  Hi, I'm Lycie! Ask me about our vehicles, importing, clearing or hire — or about buying a car in
                  general.
                </p>
                <ul className="lycie-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button type="button" onClick={() => void send(suggestion)} disabled={isSending}>
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`lycie-msg lycie-msg--${message.role}`}>
                <div className="lycie-msg__bubble">
                  {message.role === "assistant" ? <RichText text={message.text} /> : message.text}
                </div>

                {message.vehicles && message.vehicles.length > 0 && (
                  <ul className="lycie-cards">
                    {message.vehicles.map((vehicle) => (
                      <li key={vehicle.slug}>
                        <Link to={`/vehicles/${vehicle.slug}`} className="lycie-card" onClick={() => setOpen(false)}>
                          {vehicle.image && <Img src={vehicle.image} alt="" sizes="76px" />}
                          <span className="lycie-card__body">
                            <strong>{vehicle.label}</strong>
                            <span className="mono"><Price amount={vehicle.price} currency={vehicle.currency} layout="inline" /></span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}

                {message.role === "assistant" && message.logId && (
                  <div className="lycie-feedback" role="group" aria-label="Was this answer helpful?">
                    {message.feedback ? (
                      <span>Thanks for the feedback.</span>
                    ) : (
                      <>
                        <button type="button" onClick={() => rate(message, "up")} aria-label="Helpful">
                          👍
                        </button>
                        <button type="button" onClick={() => rate(message, "down")} aria-label="Not helpful">
                          👎
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isSending && messages[messages.length - 1]?.role === "user" && (
              <div className="lycie-msg lycie-msg--assistant" aria-label="Lycie is typing">
                <div className="lycie-msg__bubble lycie-typing" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          <form className="lycie-form" onSubmit={handleSubmit}>
            <label htmlFor="lycie-input" className="lycie-sr">
              Your question
            </label>
            <textarea
              id="lycie-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKeyDown}
              placeholder="Ask about a vehicle, hire, import…"
              rows={1}
              maxLength={MAX_CHARS}
            />
            <button type="submit" className="lycie-form__send" disabled={isSending || !input.trim()}>
              Send
            </button>
          </form>
          <p className="lycie-note">
            {input.length >= 400 ? `${MAX_CHARS - input.length} characters left. ` : ""}
            Lycie is an AI and can make mistakes — confirm prices and availability with our team. Please don't share
            personal details here.
          </p>
        </section>
      )}
    </>
  );
}
