import { extractKeywords } from "../insights/sentiment.util";

export interface QuestionCluster {
  /** The clearest example to show admins (the shortest question in the group). */
  representative: string;
  /** How many questions fell into this group. */
  count: number;
  /** Up to 5 distinct example questions. */
  samples: string[];
  /** Stemmed topic words shared by the group, most common first. */
  keywords: string[];
}

/** Very light stemming so "import", "importing" and "imports" group together. */
export function stem(word: string): string {
  for (const suffix of ["ing", "ed", "es", "s", "ly"]) {
    if (suffix === "s" && word.endsWith("ss")) continue; // "business" is not a plural
    if (word.length - suffix.length >= 4 && word.endsWith(suffix)) return word.slice(0, -suffix.length);
  }
  return word;
}

export function topicWords(text: string): string[] {
  return Array.from(new Set(extractKeywords(text, 12).map(stem)));
}

/** Share of the smaller set that also appears in the other (1 = one contains the other). */
export function overlapCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const other = new Set(b);
  const shared = a.filter((word) => other.has(word)).length;
  return shared / Math.min(a.length, b.length);
}

interface WorkingCluster {
  members: string[];
  words: Map<string, number>;
}

/**
 * Groups similar questions by shared topic words so "how long does importing
 * take", "import time?" and "how many weeks to import a car" count as one
 * topic. Deliberately simple and explainable: no AI, so it costs no quota and
 * an admin can see exactly why questions were grouped.
 *
 * Questions with fewer than two topic words (greetings, "ok thanks") are
 * ignored — they'd otherwise glue unrelated questions together.
 */
export function clusterQuestions(questions: string[], threshold = 0.5): QuestionCluster[] {
  const clusters: WorkingCluster[] = [];

  for (const question of questions) {
    const words = topicWords(question);
    if (words.length < 2) continue;

    let best: WorkingCluster | null = null;
    let bestScore = 0;
    for (const cluster of clusters) {
      const clusterWords = [...cluster.words.keys()];
      const score = overlapCoefficient(words, clusterWords);
      // Require at least two shared words so a single generic word ("hire") can't merge topics.
      const shared = words.filter((w) => cluster.words.has(w)).length;
      if (shared >= 2 && score >= threshold && score > bestScore) {
        best = cluster;
        bestScore = score;
      }
    }

    const target = best ?? { members: [], words: new Map<string, number>() };
    if (!best) clusters.push(target);
    target.members.push(question);
    for (const word of words) target.words.set(word, (target.words.get(word) ?? 0) + 1);
  }

  return clusters
    .map((cluster) => {
      const distinct = Array.from(new Set(cluster.members.map((m) => m.trim())));
      const byLength = [...distinct].sort((a, b) => a.length - b.length);
      return {
        representative: byLength[0],
        count: cluster.members.length,
        samples: byLength.slice(0, 5),
        keywords: [...cluster.words.entries()].sort((a, b) => b[1] - a[1]).map(([word]) => word).slice(0, 6),
      };
    })
    .sort((a, b) => b.count - a.count || a.representative.localeCompare(b.representative));
}

/**
 * A topic counts as already covered when an existing FAQ question, knowledge
 * title or earlier suggestion shares most of its topic words.
 */
export function isCovered(cluster: QuestionCluster, existingTexts: string[], threshold = 0.6): boolean {
  return existingTexts.some((text) => {
    const words = topicWords(text);
    const shared = words.filter((w) => cluster.keywords.includes(w)).length;
    return shared >= 2 && overlapCoefficient(cluster.keywords, words) >= threshold;
  });
}
