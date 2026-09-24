/**
 * "About this page" at the top of a workspace page: the guide an administrator
 * chose for this person (see System → Guides). Opened the first time a page is
 * visited; after that it stays as the person left it (remembered per page).
 */
import { useState } from "react";
import { useGuide } from "../hooks/useGuides";

const KEY = "lycie_guide_closed";

function closedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export default function PageGuide({ guideKey }: { guideKey: string | null }) {
  const guide = useGuide(guideKey);
  const [closed, setClosed] = useState(() => closedSet());
  if (!guide || !guideKey) return null;
  const open = !closed.has(guideKey);

  function toggle() {
    const next = new Set(closed);
    if (open) next.add(guideKey!);
    else next.delete(guideKey!);
    setClosed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // Not remembered; fine.
    }
  }

  return (
    <aside className={open ? "ws-guide ws-guide--open" : "ws-guide"} aria-label="About this page">
      <button type="button" className="ws-guide__toggle" aria-expanded={open} onClick={toggle}>
        <span aria-hidden="true">ⓘ</span> {open ? guide.title : `About this page: ${guide.title}`}
        <span className="ws-guide__chevron" aria-hidden="true">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="ws-guide__body">
          {guide.body.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      )}
    </aside>
  );
}
