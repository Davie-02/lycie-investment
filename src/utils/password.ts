/**
 * Password rules, strength feedback and the "suggest a strong password"
 * generator used by every screen that sets a password (sign-up, reset,
 * change password, admin accounts).
 *
 * The rules below MIRROR server/src/security/password-policy.ts so people see
 * the requirements as they type. The server is what actually enforces them —
 * anything in the browser can be bypassed — so if you change one, change the
 * other (password.test.ts keeps a few shared examples honest).
 */

export const PASSWORD_MIN_LENGTH = 10;
/** bcrypt (used by the server) ignores everything past 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

/** The passwords attackers try first; a cheap filter for the worst offenders. Same list idea as the server's. */
const COMMON_PASSWORDS = new Set([
  "password", "passw0rd", "password1", "password12", "password123", "letmein", "welcome", "welcome1",
  "qwerty", "qwertyuiop", "qwerty123", "abc123", "abcd1234", "iloveyou", "admin", "administrator",
  "adminadmin", "changeme", "monkey", "dragon", "football", "baseball", "master", "sunshine", "princess",
  "login", "starwars", "trustno1", "letmein1", "lycie", "lycieinvestments", "lycieinvestment", "malawi",
  "lilongwe", "blantyre", "toyota", "hilux", "vehicle", "vehicles", "carhire", "test", "testing", "guest",
  "secret", "shadow", "superman", "batman", "freedom", "whatever", "zaq12wsx", "1qaz2wsx", "asdfghjkl",
  "zxcvbnm", "qazwsx", "google", "facebook", "computer", "internet", "mustang", "harley", "hunter",
]);

/** A well-known password, even with digits or symbols added to the ends ("Password123!"). */
export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  const stripped = lower.replace(/[^a-z]+$/, "").replace(/^[^a-z]+/, "");
  return stripped.length > 0 && COMMON_PASSWORDS.has(stripped);
}

export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

export type StrengthLabel = "Too weak" | "Weak" | "Fair" | "Good" | "Strong";

export interface PasswordCheck {
  /** The checklist shown under the field, each ticked or not. */
  rules: PasswordRule[];
  /** True only when every rule passes — the form can submit. */
  acceptable: boolean;
  /** 0 (nothing typed / hopeless) … 4 (strong). Drives the meter. */
  score: 0 | 1 | 2 | 3 | 4;
  label: StrengthLabel;
}

/** Words from the person's own details (name, email) that shouldn't appear in their password. */
function personalWords(personalData: Array<string | undefined>): string[] {
  return personalData
    .flatMap((item) => (item ?? "").split("@")[0].toLowerCase().split(/[^a-z0-9]+/))
    .filter((word) => word.length >= 4);
}

/**
 * Evaluates a password against every rule and gives a 0–4 strength score.
 * @param personalData e.g. [name, email] — the password may not contain them.
 */
export function checkPassword(password: string, personalData: Array<string | undefined> = []): PasswordCheck {
  const lower = password.toLowerCase();
  const rules: PasswordRule[] = [
    { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(password) },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(password) },
    { id: "number", label: "A number", met: /[0-9]/.test(password) },
    { id: "common", label: "Not a common password", met: password.length > 0 && !isCommonPassword(password) },
    { id: "personal", label: "Doesn't contain your name or email", met: password.length > 0 && !personalWords(personalData).some((word) => lower.includes(word)) },
  ];

  const acceptable = rules.every((rule) => rule.met);

  // Beyond "acceptable", reward length and variety: more characters and more
  // kinds of characters both make guessing harder.
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  let score: PasswordCheck["score"] = 0;
  if (password.length > 0) score = 1;
  if (acceptable) score = 2;
  if (acceptable && password.length >= 12 && kinds >= 3) score = 3;
  if (acceptable && password.length >= 14 && kinds >= 4) score = 4;

  const labels: StrengthLabel[] = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { rules, acceptable, score, label: labels[score] };
}

/** A uniformly random integer in [0, max) from the browser's cryptographic generator (no modulo bias). */
function secureRandomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

// Characters that are easy to confuse when read aloud or copied by hand (l/1/I, O/0) are left out.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";

/**
 * A strong, random password to suggest: 16 characters with lowercase,
 * uppercase, digits and symbols all guaranteed present. Generated with the
 * browser's cryptographic random source, never Math.random().
 */
export function generateStrongPassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  // Guarantee at least two of each kind, then fill the rest from everything.
  const characters: string[] = [];
  for (const set of [LOWER, LOWER, UPPER, UPPER, DIGITS, DIGITS, SYMBOLS, SYMBOLS]) {
    characters.push(set[secureRandomInt(set.length)]);
  }
  while (characters.length < length) characters.push(all[secureRandomInt(all.length)]);

  // Fisher–Yates shuffle so the guaranteed characters aren't always at the start.
  for (let i = characters.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  return characters.join("");
}
