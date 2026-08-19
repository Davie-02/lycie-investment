import { useState } from "react";
import { useNotices } from "@/context/NoticesContext";
import { NOTICE_TYPE_STYLES } from "@/types/notice";
import "./NoticeBanner.css";

export default function NoticeBanner() {
  const { notices } = useNotices();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const banners = notices.filter((n) => n.displayAs === "banner" && !dismissedIds.has(n.id));

  if (banners.length === 0) return null;

  return (
    <div className="notice-banner-stack">
      {banners.map((notice) => {
        const style = NOTICE_TYPE_STYLES[notice.type];
        return (
          <div
            key={notice.id}
            className="notice-banner"
            style={{
              background: style.background,
              color: style.text,
              borderColor: style.border,
            }}
            role="status"
          >
            <div className="container notice-banner__inner">
              <p>
                {notice.title && <strong>{notice.title}: </strong>}
                {notice.message}
              </p>
              <button
                type="button"
                className="notice-banner__dismiss"
                style={{ color: style.text }}
                onClick={() => setDismissedIds((prev) => new Set(prev).add(notice.id))}
                aria-label="Dismiss notice"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
