import { promises as dns } from "dns";
import { registerDecorator, type ValidationOptions } from "class-validator";

/**
 * Checks that an email address is not just well-formed but plausibly able to
 * receive mail: its domain must exist and advertise a mail server. This
 * catches typos ("name@gmial.con") and made-up domains before we create an
 * account or store an enquiry we could never answer, without needing to send
 * anything.
 *
 * It cannot prove a specific mailbox exists — that is what the verification
 * email sent after sign-up is for.
 */

/** Trims and lower-cases, the one canonical form emails are stored and compared in. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Throwaway-inbox services. Sign-ups from these are refused because nobody can be reached there later. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "throwawaymail.com", "yopmail.com", "trashmail.com", "getnada.com",
  "maildrop.cc", "sharklasers.com", "dispostable.com", "fakeinbox.com", "mailnesia.com", "mintemail.com",
  "spamgourmet.com", "tempinbox.com", "emailondeck.com", "mohmal.com", "burnermail.io",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = normalizeEmail(email).split("@")[1] ?? "";
  return DISPOSABLE_DOMAINS.has(domain);
}

const LOOKUP_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 10 * 60 * 1000;
/** domain → { verdict, until }. Remembers answers for a while so busy forms don't repeat DNS lookups. */
const domainCache = new Map<string, { deliverable: boolean; until: number }>();

/** DNS errors that mean "this domain really has no mail setup" (as opposed to "DNS is having a bad day"). */
const DEFINITIVE_MISS = new Set(["ENOTFOUND", "ENODATA", "ENOTIMP"]);

/** Races a lookup against a timer, and always cancels the timer so it can't keep the process alive. */
async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Does this domain accept mail? Looks for MX records, falling back to an
 * address record (which mail rules also allow). If DNS itself is unreachable
 * or slow we say "yes" — a network hiccup must never stop a real customer
 * from signing up; only a definitive "no such domain" answer rejects.
 */
export async function domainAcceptsMail(domain: string): Promise<boolean> {
  const cached = domainCache.get(domain);
  if (cached && cached.until > Date.now()) return cached.deliverable;

  let deliverable: boolean;
  try {
    const records = await withTimeout(dns.resolveMx(domain));
    deliverable = records.length > 0;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    if (!DEFINITIVE_MISS.has(code)) {
      // Timeout / DNS failure: fail open, and don't cache the guess.
      return true;
    }
    // No MX: RFC 5321 lets a bare A/AAAA record receive mail, so check that before rejecting.
    try {
      const addresses = await withTimeout(dns.resolve4(domain));
      deliverable = addresses.length > 0;
    } catch (fallbackError) {
      const fallbackCode = (fallbackError as NodeJS.ErrnoException).code ?? "";
      if (!DEFINITIVE_MISS.has(fallbackCode)) return true;
      deliverable = false;
    }
  }

  domainCache.set(domain, { deliverable, until: Date.now() + CACHE_TTL_MS });
  return deliverable;
}

export type EmailVerdict = { ok: true } | { ok: false; reason: string };

/** Full check used by sign-up and forms: disposable-domain filter, then the mail-domain lookup. */
export async function checkEmailDeliverable(email: string): Promise<EmailVerdict> {
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1];
  if (!domain) return { ok: false, reason: "Enter a valid email address." };

  if (isDisposableEmail(normalized)) {
    return { ok: false, reason: "Temporary email addresses can't be used. Please use your regular email." };
  }
  if (!(await domainAcceptsMail(domain))) {
    return { ok: false, reason: `We couldn't find a mail server for "${domain}". Please check the spelling of your email.` };
  }
  return { ok: true };
}

/**
 * class-validator decorator for public forms: `@IsDeliverableEmail()` next to
 * `@IsEmail()` also rejects addresses whose domain can't receive mail.
 * Asynchronous because it performs the DNS lookup above.
 */
export function IsDeliverableEmail(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isDeliverableEmail",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      async: true,
      validator: {
        async validate(value: unknown) {
          // Shape errors are @IsEmail()'s job — don't double-report them.
          if (typeof value !== "string" || !value.includes("@")) return true;
          return (await checkEmailDeliverable(value)).ok;
        },
        defaultMessage() {
          return "This email address doesn't look deliverable. Please check it and try again.";
        },
      },
    });
  };
}
