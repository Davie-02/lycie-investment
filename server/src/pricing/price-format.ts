/**
 * Turning stored prices into the text customers see: "USD 26,000 (≈ MWK 45,500,000)".
 *
 * Prices are kept in US dollars. Some older listings were entered in kwacha
 * (currency "MWK"); those are converted to dollars here using the same rate, so
 * the site shows one consistent format either way.
 */

const number = (value: number) => value.toLocaleString("en-US");

/** The price expressed in US dollars, or null when it's a kwacha price and no rate is known. */
export function toUsd(amount: number, currency: string, rate: number | null): number | null {
  if (currency === "USD") return amount;
  if (currency === "MWK" && rate && rate > 0) return amount / rate;
  return null;
}

/** Kwacha equivalent of a dollar amount, rounded to the admin's chosen step (e.g. nearest 1,000). */
export function usdToMwk(usd: number, rate: number, roundTo: number): number {
  return Math.round((usd * rate) / roundTo) * roundTo;
}

/**
 * "USD 26,000 (≈ MWK 45,500,000)". With no exchange rate available the kwacha part is left out
 * (dollar prices) or the original figure is shown as-is (old kwacha prices), never a guess.
 */
export function priceText(amount: number, currency: string, rate: number | null, roundTo = 1000): string {
  const usd = toUsd(amount, currency, rate);
  if (usd === null) return `${currency} ${number(amount)}`;
  const dollars = `USD ${number(Math.round(usd))}`;
  return rate ? `${dollars} (≈ MWK ${number(usdToMwk(usd, rate, roundTo))})` : dollars;
}
