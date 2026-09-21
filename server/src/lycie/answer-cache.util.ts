/**
 * Remembers Lycie's answers to questions that were just asked, so the same question from the next
 * visitor is answered instantly (no waiting on the AI at all, and no AI quota used).
 *
 * Only standalone questions are cached (no earlier conversation to depend on) and only good answers
 * — never a "having trouble" fallback. Entries expire after `ttlMs` so changes to vehicles, prices
 * or knowledge notes reach visitors within minutes, and the cache is emptied whenever admin content
 * changes (see LycieService.forget).
 */

export interface CachedAnswer<T> {
  value: T;
  storedAt: number;
}

/** "How much is the Hilux??" and "how much is the hilux" are the same question. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class AnswerCache<T> {
  private readonly entries = new Map<string, CachedAnswer<T>>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly maxEntries = 300,
    private readonly now: () => number = () => Date.now()
  ) {}

  get(question: string): T | undefined {
    const key = normalizeQuestion(question);
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.storedAt > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(question: string, value: T): void {
    const key = normalizeQuestion(question);
    if (key.length < 3) return; // "hi", "ok" — too vague to reuse
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: this.now() });
    // Drop the oldest when full (Map keeps insertion order).
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value as string);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
