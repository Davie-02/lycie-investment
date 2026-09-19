import type { Sentiment } from "@/types/review";
import "./AdminInsights.css";

const CONFIG: Record<Sentiment, { glyph: string; label: string }> = {
  positive: { glyph: "▲", label: "Positive" },
  neutral: { glyph: "●", label: "Neutral" },
  negative: { glyph: "▼", label: "Negative" },
};

/** Icon + text + color, so sentiment never relies on color alone. */
export default function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const { glyph, label } = CONFIG[sentiment];
  return (
    <span className={`sentiment-badge sentiment-badge--${sentiment}`}>
      <span aria-hidden="true">{glyph}</span> {label}
    </span>
  );
}
