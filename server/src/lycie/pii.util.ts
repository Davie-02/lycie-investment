/**
 * Best-effort removal of personal details from customer text BEFORE it is
 * sent to the AI provider or written to the chat log.
 *
 * Why it matters: the free Gemini tier may use submitted content to improve
 * Google's products, and chat logs are read by staff. Customers shouldn't
 * have to think about that, so contact details are stripped automatically.
 *
 * It is a heuristic, not a guarantee — a name written without a cue phrase
 * ("Chikondi wants a Hilux") won't be caught — which is why the chat widget
 * also tells people not to share personal details. Prices like 18500000 are
 * deliberately NOT treated as phone numbers.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// International format: +265 991 383 466, +265-99-138-3466
const PHONE_INTL = /\+\d[\d\s().-]{6,}\d/g;
// Malawi local mobile format: 0991 383 466 / 088-123-4567 / 0991383466
const PHONE_LOCAL = /(?<![\d,.])0[89](?:[\s.-]?\d){8}(?![\d,.])/g;
// Any other very long digit run (card / national-ID / account numbers).
const LONG_NUMBER = /(?<![\d,.])\d{10,}(?![\d,.])/g;
// "my name is Chikondi Banda", "I'm Tadala", "this is John Phiri"
// The cue is matched case-insensitively by hand: a global /i flag would also let
// [A-Z] match lowercase words like "and" and swallow them into the name.
const NAME_CUE = /\b([Mm]y name is|[Ii] am called|[Ii]'m called|[Tt]his is|[Nn]ame's)\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})/g;

export function redactPii(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(PHONE_INTL, "[phone]")
    .replace(PHONE_LOCAL, "[phone]")
    .replace(LONG_NUMBER, "[number]")
    .replace(NAME_CUE, (_match, cue: string) => `${cue} [name]`);
}
