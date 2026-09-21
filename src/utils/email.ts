/**
 * Email checks for the browser.
 *
 * These give instant feedback ("did you mean gmail.com?") but the server does
 * the real checking (server/src/security/email-check.ts also looks the domain
 * up in DNS), and the confirmation email sent after sign-up is the only true
 * proof an address works.
 */

/**
 * A practical email pattern: a sensible local part, then a domain of dotted
 * labels ending in a top-level domain of 2+ letters. Deliberately stricter
 * than "has an @ sign" (which lets "a@b" through) but not the full RFC.
 */
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function isValidEmailFormat(email: string): boolean {
  const value = email.trim();
  if (value.length > 254 || value.includes("..")) return false;
  if (value.startsWith(".") || value.split("@")[0]?.endsWith(".")) return false;
  return EMAIL_PATTERN.test(value);
}

/** The mailbox providers most customers use — the reference list for spotting typos. */
const COMMON_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "live.com", "aol.com",
  "proton.me", "protonmail.com", "yahoo.co.uk", "googlemail.com", "msn.com",
];

/** Number of single-character edits between two strings (small inputs only). */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return rows[a.length][b.length];
}

/**
 * If the domain looks like a typo of a well-known one ("gmial.com",
 * "gmail.con"), returns the corrected full address to offer; otherwise null.
 */
export function suggestEmailFix(email: string): string | null {
  const value = email.trim();
  if (!isValidEmailFormat(value)) return null;

  const [local, domain] = [value.slice(0, value.lastIndexOf("@")), value.slice(value.lastIndexOf("@") + 1).toLowerCase()];
  if (COMMON_DOMAINS.includes(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    // 1–2 edits away = probably a typo; anything further is probably a genuine different domain.
    if (distance <= 2 && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

/** Message for a form field, or null when the address is fine. */
export function emailError(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!isValidEmailFormat(email)) return "Enter a valid email address, like name@example.com.";
  return null;
}
