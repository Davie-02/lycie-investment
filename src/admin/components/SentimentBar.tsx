import type { SentimentCounts } from "@/types/insights";
import "./AdminInsights.css";

interface SentimentBarProps {
  counts: SentimentCounts;
  thin?: boolean;
  showLegend?: boolean;
  /** Short "▼ 4 · ● 0 · ▲ 1" legend for use inside table rows. */
  compact?: boolean;
}

const ORDER = ["negative", "neutral", "positive"] as const;
const GLYPH = { positive: "▲", neutral: "●", negative: "▼" } as const;

/**
 * A single stacked bar ordered negative → neutral → positive (a polarity
 * scale). Every segment's count is also printed in the legend so the
 * numbers are readable without hovering and without relying on color.
 */
export default function SentimentBar({ counts, thin = false, showLegend = true, compact = false }: SentimentBarProps) {
  const total = counts.positive + counts.neutral + counts.negative;
  if (total === 0) return <p className="insights-empty">No data yet.</p>;

  const summary = ORDER.map((key) => `${counts[key]} ${key}`).join(", ");

  return (
    <div>
      <div className={thin ? "sbar sbar--thin" : "sbar"} role="img" aria-label={`Sentiment: ${summary}`}>
        {ORDER.map(
          (key) =>
            counts[key] > 0 && (
              <div
                key={key}
                className={`sbar__seg sbar__seg--${key}`}
                style={{ flexGrow: counts[key] }}
                title={`${counts[key]} ${key} (${Math.round((counts[key] / total) * 100)}%)`}
              />
            )
        )}
      </div>
      {showLegend && (
        // Same left-to-right order as the bar itself, so the legend reads
        // in the direction the eye travels along the segments.
        <div className="sbar-legend">
          {ORDER.map((key) =>
            compact ? (
              <span key={key} title={key}>
                {GLYPH[key]} <b>{counts[key]}</b>
              </span>
            ) : (
              <span key={key}>
                {GLYPH[key]} {key} <b>{counts[key]}</b> ({Math.round((counts[key] / total) * 100)}%)
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}
