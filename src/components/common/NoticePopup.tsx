import { useEffect, useState } from "react";
import { useNotices } from "@/context/NoticesContext";
import { NOTICE_TYPE_STYLES } from "@/types/notice";
import "./NoticePopup.css";

function dismissalKey(id: string, updatedAt: string): string {
  return `lycie_notice_dismissed_${id}_${updatedAt}`;
}

export default function NoticePopup() {
  const { notices } = useNotices();
  const [visibleId, setVisibleId] = useState<string | null>(null);

  const popupNotice = notices.find((n) => n.displayAs === "popup") ?? null;

  useEffect(() => {
    if (!popupNotice) {
      setVisibleId(null);
      return;
    }
    const key = dismissalKey(popupNotice.id, popupNotice.updatedAt);
    const alreadyDismissed = sessionStorage.getItem(key) === "true";
    setVisibleId(alreadyDismissed ? null : popupNotice.id);
  }, [popupNotice]);

  if (!popupNotice || visibleId !== popupNotice.id) return null;

  const style = NOTICE_TYPE_STYLES[popupNotice.type];

  function handleDismiss() {
    if (!popupNotice) return;
    sessionStorage.setItem(dismissalKey(popupNotice.id, popupNotice.updatedAt), "true");
    setVisibleId(null);
  }

  return (
    <div className="notice-popup-overlay" role="dialog" aria-modal="true">
      <div
        className="notice-popup"
        style={{ background: style.background, color: style.text, borderColor: style.border }}
      >
        <button
          type="button"
          className="notice-popup__close"
          style={{ color: style.text }}
          onClick={handleDismiss}
          aria-label="Close"
        >
          ×
        </button>
        {popupNotice.title && <h2 style={{ color: style.text }}>{popupNotice.title}</h2>}
        <p>{popupNotice.message}</p>
      </div>
    </div>
  );
}
