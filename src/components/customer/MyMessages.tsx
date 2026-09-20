import { useEffect, useState } from "react";
import { getMyMessages, markMessagesRead, type CustomerMessage } from "@/services/customer.service";
import RichText from "@/components/lycie/RichText";
import "./MyMessages.css";

/** Messages our team sent to this customer, kept inside their Lycie profile. */
export default function MyMessages() {
  const [items, setItems] = useState<CustomerMessage[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyMessages()
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setUnread(data.unread);
        if (data.unread > 0) setOpenId(data.items.find((m) => !m.readAt)?.id ?? null);
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Opening the inbox counts as reading it.
  useEffect(() => {
    if (unread === 0) return;
    const timer = setTimeout(() => {
      void markMessagesRead().catch(() => undefined);
    }, 2500);
    return () => clearTimeout(timer);
  }, [unread]);

  return (
    <div className="customer-account__history">
      <h2>
        Messages from Lycie Investments
        {unread > 0 && <span className="my-messages__badge">{unread} new</span>}
      </h2>
      {items === null && <p className="text-muted">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-muted">No messages yet. When our team writes to you about a request, it will appear here.</p>
      )}
      <ul className="my-messages">
        {(items ?? []).map((message) => {
          const isOpen = openId === message.id;
          const isNew = !message.readAt && unread > 0;
          return (
            <li key={message.id} className={isNew ? "my-messages__item my-messages__item--new" : "my-messages__item"}>
              <button type="button" className="my-messages__head" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : message.id)}>
                <strong>{message.subject}</strong>
                <span className="text-muted">
                  {message.sentByName} · {new Date(message.createdAt).toLocaleDateString()}
                </span>
              </button>
              {isOpen && (
                <div className="my-messages__body">
                  <RichText text={message.body} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
