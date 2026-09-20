/**
 * Picking which comments deserve to be shown as testimonials. Deliberately
 * simple and explainable: a testimonial must be clearly positive, long enough
 * to say something, short enough to quote, and free of personal details or
 * links. Nothing here rewrites the customer's words.
 */
export const MIN_QUOTE_CHARS = 40;
export const MAX_QUOTE_CHARS = 400;

const PERSONAL = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{7,}\d|https?:\/\/|www\./i;

export interface Candidate {
  source: "review" | "comment";
  sourceId: string;
  text: string;
  authorName: string;
  rating: number | null;
  /** -1..1 from the offline sentiment analysis. */
  sentimentScore: number;
}

export function isTestimonialWorthy(c: Candidate): boolean {
  const text = c.text.trim();
  if (text.length < MIN_QUOTE_CHARS || text.length > MAX_QUOTE_CHARS) return false;
  if (PERSONAL.test(text)) return false;
  if (c.rating !== null && c.rating < 4) return false;
  return c.sentimentScore >= 0.25;
}

/** 0-1: blends how positive the wording is, the star rating (if any) and how much it says. */
export function rankScore(c: Candidate): number {
  const positivity = Math.min(1, Math.max(0, c.sentimentScore));
  const stars = c.rating === null ? positivity : c.rating / 5;
  const substance = Math.min(1, c.text.trim().length / 200);
  return Math.round((positivity * 0.5 + stars * 0.3 + substance * 0.2) * 100) / 100;
}
