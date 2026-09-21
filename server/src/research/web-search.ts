/**
 * Recent news headlines from GDELT — an open, key-less index of world news that is free to use.
 *
 * This is the FALLBACK research source, used only when Google's live web search isn't available
 * on the AI plan. It gives headlines (title, site, date, link), not full articles, so it can only
 * support leads that a headline actually states. GDELT asks for at most one request every ~5 seconds,
 * so results are cached (see ResearchService) and never fetched in bursts.
 */

export interface Headline {
  title: string;
  url: string;
  domain: string;
  /** ISO date the article was first seen. */
  seenAt: string | null;
}

type FetchFn = typeof fetch;

/** GDELT's "seendate" looks like 20260921T143000Z. */
function parseSeenDate(value: unknown): string | null {
  const match = typeof value === "string" ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value) : null;
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function fetchHeadlines(query: string, fetchFn: FetchFn = fetch, timeoutMs = 15_000, max = 25): Promise<Headline[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `${query} sourcelang:english`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", String(max));
  url.searchParams.set("timespan", "30d");
  url.searchParams.set("sort", "datedesc");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url.toString(), { signal: controller.signal });
    if (!response.ok) return [];
    const body = (await response.json().catch(() => null)) as { articles?: Array<Record<string, unknown>> } | null;

    const seen = new Set<string>();
    const headlines: Headline[] = [];
    for (const article of body?.articles ?? []) {
      const title = typeof article.title === "string" ? article.title.trim() : "";
      const link = typeof article.url === "string" ? article.url : "";
      if (title.length < 15 || !/^https?:\/\//i.test(link)) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue; // syndicated copies of the same story
      seen.add(key);
      headlines.push({ title, url: link, domain: typeof article.domain === "string" ? article.domain : new URL(link).hostname, seenAt: parseSeenDate(article.seendate) });
    }
    return headlines;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
