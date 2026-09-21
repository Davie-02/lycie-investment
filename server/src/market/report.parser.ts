/**
 * Reads the AI's market briefing. As with deals, the reply is untrusted text: extract the JSON
 * object, keep only the fields we expect, and cap lengths so nothing odd is ever stored.
 */
export interface MarketReportContent {
  headline: string;
  /** What is selling most right now, with a rough typical price in US dollars. */
  trending: Array<{ name: string; why: string; typicalPriceUsd: number | null }>;
  /** Concrete things the company could do to win more customers. */
  opportunities: Array<{ action: string; why: string }>;
  /** Ways to stand out from other importers and dealers. */
  standOut: Array<{ idea: string; why: string }>;
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function list<T>(value: unknown, map: (item: Record<string, unknown>) => T | null, limit: number): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    if (item && typeof item === "object") {
      const mapped = map(item as Record<string, unknown>);
      if (mapped) out.push(mapped);
    }
    if (out.length >= limit) break;
  }
  return out;
}

export function parseReport(reply: string): MarketReportContent | null {
  const unfenced = reply.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const report: MarketReportContent = {
    headline: str(raw.headline, 300),
    trending: list(
      raw.trending,
      (item) => {
        const name = str(item.name, 100);
        const price = Number(item.typicalPriceUsd);
        return name ? { name, why: str(item.why, 400), typicalPriceUsd: Number.isFinite(price) && price > 0 && price < 10_000_000 ? Math.round(price) : null } : null;
      },
      8
    ),
    opportunities: list(raw.opportunities, (item) => (str(item.action, 300) ? { action: str(item.action, 300), why: str(item.why, 400) } : null), 8),
    standOut: list(raw.standOut, (item) => (str(item.idea, 300) ? { idea: str(item.idea, 300), why: str(item.why, 400) } : null), 8),
  };
  // A briefing with nothing usable in it is treated as a failure, not saved.
  return report.trending.length + report.opportunities.length + report.standOut.length > 0 ? report : null;
}
