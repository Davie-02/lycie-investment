/**
 * Turns the AI's reply from a deals search into clean, validated deal candidates.
 *
 * The model is asked for a JSON list but its output is untrusted text: it may wrap the list in
 * code fences, add commentary, drop fields, or invent odd values. Nothing from it reaches the
 * database without passing through here — and the CUSTOMER-FACING wording is scrubbed of web
 * addresses, email addresses and "according to X" attributions, because deals must never show
 * where they were found.
 */

export interface DealCandidate {
  title: string;
  summary: string;
  priceUsd: number | null;
  vehicleLabel: string | null;
  validUntil: Date | null;
  /** Staff-only instructions for actually getting the deal. */
  howToGet: string;
}

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/** Bare domain names such as "autotrader.co.za" or "copart.com/lot/1". */
const DOMAIN_PATTERN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co\.[a-z]{2}|co|io|info|biz|mw|za|uk|jp|ae|de|us|au)\b(?:\/\S*)?/gi;
const ATTRIBUTION_PATTERN = /\b(?:according to|as (?:reported|listed|advertised) (?:by|on)|via|found on|listed on|from the website of)\b[^.,;]*|\bsources?\s*:[^.,;]*/gi;

/** Customer-facing text with anything that reveals a source removed. */
export function scrubPublicText(text: string): string {
  return text
    .replace(URL_PATTERN, "")
    .replace(EMAIL_PATTERN, "")
    .replace(ATTRIBUTION_PATTERN, "")
    .replace(DOMAIN_PATTERN, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/[([]\s*[)\]]/g, "")
    .trim();
}

/** Pulls the JSON list out of a reply that may include code fences or surrounding sentences. */
export function extractJsonArray(text: string): unknown[] | null {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(unfenced.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Accepts only a real, not-yet-past date; anything else means "no end date". */
function parseFutureDate(value: unknown, now: Date): Date | null {
  const text = asString(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null;
  const date = new Date(text.slice(0, 10) + "T23:59:59Z");
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime() >= now.getTime() ? date : null;
}

/**
 * Validates each item and returns the good ones (at most `limit`).
 * An item needs a real title and a usable summary; everything else is optional.
 */
export function parseDeals(reply: string, now: Date = new Date(), limit = 10): DealCandidate[] {
  const items = extractJsonArray(reply);
  if (!items) return [];

  const candidates: DealCandidate[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    const title = scrubPublicText(asString(item.title)).slice(0, 120);
    const summary = scrubPublicText(asString(item.summary)).slice(0, 500);
    if (title.length < 4 || summary.length < 15) continue;

    const price = typeof item.priceUsd === "number" ? item.priceUsd : Number(item.priceUsd);
    candidates.push({
      title,
      summary,
      priceUsd: Number.isFinite(price) && price > 0 && price < 10_000_000 ? Math.round(price) : null,
      vehicleLabel: scrubPublicText(asString(item.vehicle)).slice(0, 120) || null,
      validUntil: parseFutureDate(item.validUntil, now),
      howToGet: asString(item.howToGet).slice(0, 2000),
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}
