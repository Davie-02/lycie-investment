/**
 * Price maths for the browser. Mirrors server/src/pricing/price-format.ts so a price looks the
 * same on the site, in Lycie's answers and in the admin.
 *
 * Prices are stored in US dollars. Older listings entered in kwacha (currency "MWK") are
 * converted to dollars for display with the same exchange rate, so the site is consistent.
 */

const number = (value: number) => value.toLocaleString("en-US");

/** The amount in US dollars, or null when it's a kwacha price and there is no rate yet. */
export function toUsd(amount: number, currency: string, rate: number | null): number | null {
  if (currency === "USD") return amount;
  if (currency === "MWK" && rate && rate > 0) return amount / rate;
  return null;
}

/** Kwacha equivalent of a dollar amount, rounded to the admin's chosen step (e.g. nearest 1,000). */
export function usdToMwk(usd: number, rate: number, roundTo: number): number {
  return Math.round((usd * rate) / roundTo) * roundTo;
}

/** "≈ MWK 45,500,000 at today's rate" under a dollar input, or a gentle nudge when nothing is typed yet. */
export function usdHint(value: string, rate: number | null, roundTo: number): string {
  const usd = Number(value);
  if (!value || !Number.isFinite(usd)) return "Enter the price in US dollars. The kwacha equivalent is worked out automatically.";
  return rate ? `≈ MWK ${usdToMwk(usd, rate, roundTo).toLocaleString("en-US")} at today's rate` : "Kwacha equivalent unavailable until an exchange rate is set.";
}

export interface PriceParts {
  /** "$26,000" — or, for a kwacha price with no rate, the original "MWK 45,500,000". */
  main: string;
  /** "≈ MWK 45,500,000", or null when there is nothing to add. */
  approx: string | null;
}

/** The two pieces every price is drawn from: the dollar amount and the approximate kwacha. */
export function priceParts(amount: number, currency: string, rate: number | null, roundTo = 1000): PriceParts {
  const usd = toUsd(amount, currency, rate);
  if (usd === null) return { main: `${currency} ${number(amount)}`, approx: null };
  return {
    main: `$${number(Math.round(usd))}`,
    approx: rate ? `≈ MWK ${number(usdToMwk(usd, rate, roundTo))}` : null,
  };
}

/** One-line form for tables, emails and specs: "$26,000 (≈ MWK 45,500,000)". */
export function priceLabel(amount: number, currency: string, rate: number | null, roundTo = 1000): string {
  const { main, approx } = priceParts(amount, currency, rate, roundTo);
  return approx ? `${main} (${approx})` : main;
}
