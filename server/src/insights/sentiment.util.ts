/**
 * Offline sentiment + keyword analysis for short customer feedback
 * (reviews, contact messages, inquiries).
 *
 * Deliberately a small lexicon-based scorer rather than an external API:
 * it's free, instant, private (customer text never leaves the server), and
 * predictable enough that an admin can understand why something was
 * labelled negative. It is tuned for vehicle-sales / service feedback and
 * handles the two things that most often flip a naive scorer — negation
 * ("not good") and intensifiers ("very poor") — but it is a heuristic, not
 * a language model: sarcasm and heavy slang will fool it. Ratings, when
 * present, are blended in so a 1-star review is never labelled positive on
 * text alone.
 */

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentResult {
  /** -1 (very negative) .. 1 (very positive) */
  score: number;
  label: SentimentLabel;
  keywords: string[];
}

const POSITIVE: Record<string, number> = {
  good: 1, great: 2, excellent: 2, amazing: 2, awesome: 2, fantastic: 2, wonderful: 2,
  perfect: 2, love: 2, loved: 2, best: 2, happy: 1.5, pleased: 1.5, satisfied: 1.5,
  smooth: 1, reliable: 1.5, trustworthy: 2, honest: 1.5, professional: 1.5, friendly: 1.5,
  helpful: 1.5, fast: 1, quick: 1, prompt: 1, easy: 1, clean: 1, comfortable: 1,
  affordable: 1.5, cheap: 0.5, fair: 1, recommend: 2, recommended: 2, quality: 1,
  impressed: 1.5, superb: 2, brilliant: 2, nice: 1, thanks: 0.5, thank: 0.5, grateful: 1.5,
  responsive: 1.5, transparent: 1.5, safe: 1, beautiful: 1.5, stunning: 2, worth: 1,
  pleasant: 1, efficient: 1.5, seamless: 2, delighted: 2,
};

const NEGATIVE: Record<string, number> = {
  bad: -1, poor: -1.5, terrible: -2, awful: -2, horrible: -2, worst: -2, hate: -2,
  hated: -2, disappointed: -1.5, disappointing: -1.5, unhappy: -1.5, angry: -1.5,
  slow: -1, delay: -1, delayed: -1.5, late: -1, waiting: -0.5, expensive: -1,
  overpriced: -2, rude: -2, unprofessional: -2, dishonest: -2, scam: -3, fraud: -3,
  fake: -2, lied: -2, lie: -2, broken: -1.5, damaged: -1.5, faulty: -1.5, problem: -1,
  problems: -1, issue: -0.5, issues: -0.5, complaint: -1, complain: -1, unreliable: -1.5,
  useless: -2, ignored: -1.5, unresponsive: -2, refund: -0.5, waste: -1.5, worse: -1.5,
  dirty: -1, uncomfortable: -1, noisy: -0.5, confusing: -1, difficult: -1, hidden: -1,
  misleading: -2, cheated: -3, stress: -1, stressful: -1.5, never: -0.5,
};

const NEGATORS = new Set([
  "not", "no", "never", "hardly", "without", "isnt", "wasnt", "dont", "didnt",
  "doesnt", "cant", "cannot", "wont", "couldnt", "wouldnt", "arent", "werent",
]);

const INTENSIFIERS: Record<string, number> = {
  very: 1.5, really: 1.4, extremely: 1.8, so: 1.3, super: 1.5, absolutely: 1.6,
  totally: 1.4, highly: 1.4, incredibly: 1.7, quite: 1.2,
};

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "was", "were", "are", "you", "your",
  "have", "has", "had", "but", "not", "they", "them", "their", "from", "will", "would",
  "could", "should", "about", "very", "just", "than", "then", "when", "what", "which",
  "there", "here", "been", "being", "also", "into", "over", "such", "some", "any",
  "can", "our", "out", "all", "get", "got", "its", "his", "her", "she", "him", "who",
  "how", "why", "too", "much", "many", "more", "most", "only", "even", "still", "well",
  "like", "one", "two", "again", "because", "while", "after", "before", "under", "again",
  "really", "thing", "things", "day", "days", "time", "times", "please", "hello", "dear",
  "regards", "thanks", "thank", "sir", "madam", "want", "need", "know", "let", "make",
  "made", "see", "say", "said", "going", "went", "come", "came", "take", "took",
  "vehicle", "vehicles", "car", "cars", "lycie", "investments", "investment",
]);

const NEUTRAL_THRESHOLD = 0.15;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z]+/)
    .filter((token) => token.length > 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function labelFor(score: number): SentimentLabel {
  if (score > NEUTRAL_THRESHOLD) return "positive";
  if (score < -NEUTRAL_THRESHOLD) return "negative";
  return "neutral";
}

/** Extracts up to `limit` distinct, meaningful words, most frequent first. */
export function extractKeywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    if (token.length < 4 || STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

/** Scores text alone (no rating). */
export function analyzeText(text: string): SentimentResult {
  const tokens = tokenize(text);
  let total = 0;

  tokens.forEach((token, index) => {
    const base = POSITIVE[token] ?? NEGATIVE[token];
    if (base === undefined) return;

    let value = base;
    // Look back up to two words for a negator ("not very good") and one
    // word for an intensifier ("very poor").
    const window = tokens.slice(Math.max(0, index - 2), index);
    if (window.some((word) => NEGATORS.has(word))) value = -value * 0.8;
    const previous = tokens[index - 1];
    if (previous && INTENSIFIERS[previous]) value *= INTENSIFIERS[previous];

    total += value;
  });

  // tanh squashes an unbounded sum into (-1, 1) so one very long rant or
  // rave can't dominate purely by length.
  const score = Math.tanh(total / 3);
  return { score, label: labelFor(score), keywords: extractKeywords(text) };
}

/**
 * Blends the star rating (the customer's own explicit verdict) with the
 * text score. Rating carries more weight because it's unambiguous; text
 * still matters for catching e.g. a 3-star review full of complaints.
 */
export function analyzeReview(text: string, rating: number): SentimentResult {
  const textResult = analyzeText(text);
  const ratingScore = clamp((rating - 3) / 2, -1, 1);
  const score = clamp(ratingScore * 0.6 + textResult.score * 0.4, -1, 1);
  return { score, label: labelFor(score), keywords: textResult.keywords };
}
