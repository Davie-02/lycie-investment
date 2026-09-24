/** Country code assumed for numbers written locally (0991 383 466). Malawi = 265. Same rule as the website's contactLinks.ts. */
const DEFAULT_COUNTRY_CODE = "265";

/** Digits only, with the country code, as WhatsApp requires (no "+", spaces or leading zero). */
export function toInternationalDigits(phone: string, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (trimmed.startsWith("+")) return digits;
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) digits = countryCode + digits.slice(1);
  else if (!digits.startsWith(countryCode) && digits.length <= 9) digits = countryCode + digits;
  return digits;
}
