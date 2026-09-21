import { extractKeywords } from "../insights/sentiment.util";

export interface KnowledgeItem {
  title: string;
  category: string;
  content: string;
}

/** Rough size of an item once formatted into the prompt. */
function sizeOf(item: KnowledgeItem): number {
  return item.title.length + item.category.length + item.content.length + 12;
}

/** How many of the question's keywords appear in the item's text. */
export function overlapScore(item: KnowledgeItem, questionKeywords: string[]): number {
  const haystack = `${item.title} ${item.content}`.toLowerCase();
  return questionKeywords.reduce((score, word) => (haystack.includes(word) ? score + 1 : score), 0);
}

/**
 * Chooses which knowledge goes into the prompt.
 *
 * A dealership's FAQs and policies are usually small, so when everything
 * fits the budget we include ALL of it — no search means no chance of a
 * relevant entry being missed. Only once it outgrows the budget do we fall
 * back to relevance: database full-text matches first (their order is the
 * database's ts_rank), then simple keyword overlap for the rest.
 */
export function selectKnowledge(
  items: KnowledgeItem[],
  question: string,
  budgetChars: number,
  fullTextMatches: KnowledgeItem[] = []
): KnowledgeItem[] {
  const total = items.reduce((sum, item) => sum + sizeOf(item), 0);
  if (total <= budgetChars) return items;

  const keywords = extractKeywords(question, 12);
  const matched = new Set(fullTextMatches);
  const rest = items
    .filter((item) => !matched.has(item))
    .map((item) => ({ item, score: overlapScore(item, keywords) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  const chosen: KnowledgeItem[] = [];
  let used = 0;
  for (const item of [...fullTextMatches, ...rest]) {
    const size = sizeOf(item);
    if (used + size > budgetChars) continue;
    chosen.push(item);
    used += size;
  }
  return chosen;
}

export interface KnowledgeMatch {
  item: KnowledgeItem;
  /** 0–1: how much of the question's meaning-bearing words the entry's title shares (1 = same words). */
  score: number;
}

/**
 * The knowledge entry whose TITLE (for FAQs, the question) is most like the visitor's question, or null.
 * Compares meaning-bearing words only (stop words dropped), so "How long does clearing take?" matches the FAQ
 * "How long does clearing take at the border?" but not "What are your opening hours?".
 * Used to answer common questions instantly with no AI call, and as a real answer when the AI is unavailable.
 */
export function bestKnowledgeMatch(items: KnowledgeItem[], question: string, minScore = 0, minShared = 1): KnowledgeMatch | null {
  const wanted = new Set(extractKeywords(question, 12));
  if (wanted.size === 0) return null;

  let best: KnowledgeMatch | null = null;
  for (const item of items) {
    const words = new Set(extractKeywords(item.title, 12));
    if (words.size === 0) continue;
    let shared = 0;
    for (const word of wanted) if (words.has(word)) shared += 1;
    // Jaccard similarity: shared words over all distinct words in either.
    const score = shared / (wanted.size + words.size - shared);
    if (shared >= minShared && score >= minScore && (!best || score > best.score)) best = { item, score };
  }
  return best;
}
