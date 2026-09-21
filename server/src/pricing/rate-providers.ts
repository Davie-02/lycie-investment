/**
 * Where the live USD → Malawi Kwacha (MWK) exchange rate comes from.
 *
 * Two free, key-less public sources are tried in order, so one being down doesn't
 * stop prices updating:
 *   1. open.er-api.com — updated about once a day
 *   2. the "currency-api" dataset on the jsDelivr CDN — updated daily
 *
 * Neither is a trading-desk feed: they publish reference rates, refreshed roughly daily.
 * That is why the admin can also set a MANUAL rate or add a margin — in Malawi the
 * everyday market rate can differ noticeably from the published one.
 */

export interface LiveRate {
  /** Kwacha per 1 US dollar. */
  rate: number;
  /** Which source answered (shown to admins only). */
  provider: string;
}

type FetchFn = typeof fetch;

const SOURCES: Array<{ name: string; url: string; pick: (body: unknown) => unknown }> = [
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    pick: (body) => (body as { rates?: Record<string, number> })?.rates?.MWK,
  },
  {
    name: "currency-api (jsDelivr)",
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    pick: (body) => (body as { usd?: Record<string, number> })?.usd?.mwk,
  },
];

/** A rate is only believable if it is a positive, finite number in a sane range for kwacha. */
export function isPlausibleRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 100 && value < 100_000;
}

async function fetchWithTimeout(fetchFn: FetchFn, url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchFn(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Asks each source in turn; returns the first believable answer, or null if none worked. */
export async function fetchLiveRate(fetchFn: FetchFn = fetch, timeoutMs = 6_000): Promise<LiveRate | null> {
  for (const source of SOURCES) {
    try {
      const response = await fetchWithTimeout(fetchFn, source.url, timeoutMs);
      if (!response.ok) continue;
      const rate = source.pick(await response.json());
      if (isPlausibleRate(rate)) return { rate, provider: source.name };
    } catch {
      // Network error, timeout or unreadable answer: try the next source.
    }
  }
  return null;
}
