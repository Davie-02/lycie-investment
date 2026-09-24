import { promises as dns } from "dns";
import { createHash } from "crypto";
import { isIP } from "net";
import { Logger } from "@nestjs/common";
import { registerDecorator, type ValidationArguments, type ValidationOptions } from "class-validator";

/**
 * Checks that an email address is real enough to use, in layers from cheapest
 * to strongest:
 *
 *  1. Shape: a properly formed address (length limits, no double dots, a real
 *     top-level domain).
 *  2. Typos of the big providers ("gmial.com", "gmail.con", "yahho.com") are
 *     refused with a suggestion. This matters because many typo domains are
 *     registered by squatters WITH mail servers, so the DNS check alone would
 *     happily accept them — and the customer's mail would go to a stranger.
 *  3. Throwaway-inbox services are refused.
 *  4. DNS: the domain must exist and publish mail servers (MX), those servers
 *     must resolve to real public addresses, and the domain must not publish
 *     a "null MX" (RFC 7505: "this domain never receives mail").
 *  5. Optionally, a mailbox-verification service (Kickbox, ZeroBounce or
 *     Abstract — set EMAIL_VERIFICATION_PROVIDER and EMAIL_VERIFICATION_API_KEY)
 *     asks the provider's mail server whether that exact mailbox exists. Used
 *     for accounts (sign-up, email change, new admins), not for every form.
 *
 * Every network step fails OPEN: if DNS or the verification service is slow or
 * down, the address is accepted, so an outage never blocks a real customer.
 * Only a definitive "no" rejects. The confirmation email sent after sign-up
 * remains the final proof that a person owns the mailbox.
 *
 * Why not connect to the mail server ourselves ("SMTP probing")? Hosting
 * providers block outgoing port 25, Gmail/Outlook/Yahoo answer "yes" to
 * everything or treat probes as abuse, and probing gets the server's address
 * blacklisted. The verification services do this properly from their own
 * reputation-managed servers.
 */

const logger = new Logger("EmailCheck");

/** Trims and lower-cases, the one canonical form emails are stored and compared in. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------------------------------------------------------------- 1. shape

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** A properly formed address? (Stricter than "has an @", looser than the full RFC — what real mailboxes use.) */
export function hasValidEmailShape(email: string): boolean {
  const value = email.trim();
  if (value.length > 254) return false;
  const at = value.lastIndexOf("@");
  if (at < 1) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL.test(label))) return false;
  return /^[a-z]{2,}$/i.test(labels[labels.length - 1]) || /^xn--[a-z0-9-]+$/i.test(labels[labels.length - 1]);
}

// ---------------------------------------------------------------- 2. typos

/** Big providers whose name is only ever used with the listed domains. */
const PROVIDERS: Record<string, string> = {
  gmail: "gmail.com",
  googlemail: "googlemail.com",
  yahoo: "yahoo.com",
  hotmail: "hotmail.com",
  outlook: "outlook.com",
  icloud: "icloud.com",
  live: "live.com",
  protonmail: "protonmail.com",
};

/** Real domains that look like typos but aren't (country versions, other genuine providers). */
const GENUINE_LOOKALIKES = new Set([
  "mail.com", "email.com", "cloud.com", "gmail.com", "gmx.com", "gmx.net", "ymail.com", "aol.com", "msn.com", "me.com", "mac.com", "live.co.uk", "live.co.za",
  "yahoo.co.uk", "yahoo.co.za", "yahoo.fr", "yahoo.de", "yahoo.co.in", "yahoo.ca", "yahoo.com.au", "yahoo.co.jp", "yahoo.it", "yahoo.es",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it", "hotmail.es", "hotmail.co.za",
  "outlook.fr", "outlook.de", "outlook.co.uk", "outlook.co.za", "outlook.es", "outlook.it", "proton.me", "pm.me",
]);

/** Misspellings of ".com". */
const COM_TYPOS = new Set(["con", "cpm", "cmo", "cm", "om", "comm", "vom", "xom", "coom", "co"]);

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const swap = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? rows[i - 2][j - 2] + 1 : Infinity;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), swap);
    }
  }
  return rows[a.length][b.length];
}

/**
 * If the domain is a misspelling of a big provider, the corrected domain
 * ("gmial.com" → "gmail.com", "gmail.con" → "gmail.com"); otherwise null.
 */
export function suggestDomainFix(domain: string): string | null {
  const d = domain.toLowerCase();
  if (GENUINE_LOOKALIKES.has(d) || Object.values(PROVIDERS).includes(d)) return null;

  const labels = d.split(".");
  const name = labels[0];
  const tld = labels.slice(1).join(".");

  for (const [provider, real] of Object.entries(PROVIDERS)) {
    if (name === provider) {
      // Right name, wrong ending: "gmail.co", "yahoo.con". (Country versions like yahoo.fr are allow-listed above.)
      if (COM_TYPOS.has(tld) || provider === "gmail" || provider === "icloud" || provider === "googlemail") return real;
      continue;
    }
    // Short names ("live") are too close to real words to guess from.
    if (provider.length >= 5 && editDistance(name, provider) === 1 && (tld === "com" || COM_TYPOS.has(tld))) return real;
  }
  return null;
}

// ---------------------------------------------------------------- 3. disposable

/**
 * Throwaway-inbox services. Sign-ups from these are refused because nobody
 * can be reached there later. Not exhaustive (new ones appear daily) — the
 * optional verification service below also detects them.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "mailinator.net", "mailinator2.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamailblock.com", "grr.la", "sharklasers.com", "spam4.me", "pokemail.net",
  "10minutemail.com", "10minutemail.net", "10minutemail.co.uk", "10minemail.com", "20minutemail.com", "tempmail.com",
  "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmail.dev", "tempmailo.com", "tempmail.plus", "tempr.email",
  "tmpmail.org", "tmpmail.net", "tmail.ws", "throwawaymail.com", "throwam.com", "yopmail.com", "yopmail.net", "yopmail.fr",
  "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf", "trashmail.com", "trashmail.net", "trashmail.de", "trashmail.me",
  "trashmail.io", "trash-mail.com", "trashmail.at", "wegwerfmail.de", "wegwerfmail.net", "getnada.com", "nada.email",
  "maildrop.cc", "dispostable.com", "fakeinbox.com", "fakemail.net", "mailnesia.com", "mintemail.com", "spamgourmet.com",
  "tempinbox.com", "emailondeck.com", "mohmal.com", "burnermail.io", "mailcatch.com", "mailnull.com", "mytemp.email",
  "mytrashmail.com", "spambox.us", "spamfree24.org", "spamex.com", "incognitomail.org", "anonbox.net", "anonymbox.com",
  "discard.email", "discardmail.com", "discardmail.de", "dropmail.me", "emailfake.com", "email-fake.com", "fakemailgenerator.com",
  "armyspy.com", "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com",
  "superrito.com", "teleworm.us", "harakirimail.com", "inboxkitten.com", "mail7.io", "mailpoof.com", "mailsac.com",
  "mailtemp.info", "minuteinbox.com", "moakt.com", "mt2015.com", "owlymail.com", "linshiyouxiang.net", "33mail.com",
  "spamdecoy.net", "tempemail.co", "tempemail.net", "temporarymail.com", "temporaryemail.net", "throwawayemailaddress.com",
  "trbvm.com", "getairmail.com", "airmail.cc", "zetmail.com", "vomoto.com", "boun.cr", "byom.de", "chacuo.net", "crazymailing.com",
  "deadaddress.com", "disposableaddress.com", "disposableemailaddresses.com", "e4ward.com", "emailisvalid.com",
  "emailtemporario.com.br", "ephemail.net", "etranquil.com", "filzmail.com", "haltospam.com", "hidemail.de", "hmamail.com",
  "hulapla.de", "ieatspam.eu", "ieatspam.info", "imails.info", "instant-mail.de", "kasmail.com", "klzlk.com", "kurzepost.de",
  "lroid.com", "mail-temporaire.fr", "mailexpire.com", "mailforspam.com", "mailfreeonline.com", "mailimate.com", "mailmoat.com",
  "mailshell.com", "mailzilla.com", "meltmail.com", "messagebeamer.de", "mfsa.ru", "nepwk.com", "netmails.net", "nowmymail.com",
  "objectmail.com", "obobbo.com", "oneoffemail.com", "pookmail.com", "proxymail.eu", "quickinbox.com", "rcpt.at", "recode.me",
  "rmqkr.net", "safetymail.info", "sendspamhere.com", "shortmail.net", "sneakemail.com", "sogetthis.com", "soodonims.com",
  "spam.la", "spamavert.com", "spambob.com", "spambog.com", "spamcero.com", "spamcorptastic.com", "spamday.com", "spamgoes.in",
  "spamhole.com", "spamify.com", "spaml.com", "spamspot.com", "spamthis.co.uk", "spamthisplease.com", "supergreatmail.com",
  "suremail.info", "tempalias.com", "tempe-mail.com", "tempomail.fr", "tempymail.com", "thankyou2010.com", "thisisnotmyrealemail.com",
  "trash2009.com", "trashdevil.com", "trashymail.com", "tyldd.com", "uggsrock.com", "wh4f.org", "whyspam.me", "willselfdestruct.com",
  "xagloo.com", "xemaps.com", "xents.com", "xmaily.com", "xoxy.net", "yep.it", "yogamaven.com", "yuurok.com", "zippymail.info",
  "zoemail.org", "emlpro.com", "emltmp.com", "tmpeml.com", "tmpbox.net", "fexpost.com", "fextemp.com", "rover.info",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = normalizeEmail(email).split("@")[1] ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Subdomains of throwaway services ("x.mailinator.com") too.
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
  return false;
}

// ---------------------------------------------------------------- 4. DNS

const LOOKUP_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 10 * 60 * 1000;
/** domain → { verdict, until }. Remembers answers for a while so busy forms don't repeat DNS lookups. */
const domainCache = new Map<string, { deliverable: boolean; until: number }>();

/** DNS errors that mean "this really doesn't exist" (as opposed to "DNS is having a bad day"). */
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

/** Addresses that can't be a real public mail server (loopback, private networks, link-local, "this host"). */
export function isNonPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd");
}

type HostVerdict = "public" | "none" | "unknown";

/** Does this mail-server name point at a real public address? */
async function hostResolves(host: string): Promise<HostVerdict> {
  const lookups = await Promise.allSettled([withTimeout(dns.resolve4(host)), withTimeout(dns.resolve6(host))]);
  const addresses = lookups.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  if (addresses.length > 0) return addresses.some((address) => !isNonPublicAddress(address)) ? "public" : "none";
  const definitive = lookups.every(
    (result) => result.status === "rejected" && DEFINITIVE_MISS.has((result.reason as NodeJS.ErrnoException).code ?? "")
  );
  return definitive ? "none" : "unknown";
}

/**
 * Does this domain accept mail? Looks for MX records (refusing a "null MX"
 * and mail servers that don't resolve to a public address), falling back to
 * an address record (which mail rules also allow). If DNS itself is
 * unreachable or slow the answer is "yes" — only a definitive answer rejects.
 */
export async function domainAcceptsMail(domain: string): Promise<boolean> {
  const cached = domainCache.get(domain);
  if (cached && cached.until > Date.now()) return cached.deliverable;

  let deliverable: boolean;
  try {
    const records = await withTimeout(dns.resolveMx(domain));
    const hosts = records.map((record) => record.exchange.replace(/\.$/, "")).filter(Boolean);
    if (records.length > 0 && hosts.length === 0) {
      deliverable = false; // RFC 7505 null MX: the domain says it never receives mail
    } else if (hosts.length === 0) {
      deliverable = false;
    } else {
      // Check a few of the preferred servers; one that works is enough.
      const verdicts = await Promise.all(
        [...records].sort((a, b) => a.priority - b.priority).slice(0, 3).map((record) => hostResolves(record.exchange.replace(/\.$/, "")))
      );
      if (verdicts.includes("public")) deliverable = true;
      else if (verdicts.includes("unknown")) return true; // not sure: fail open, don't cache
      else deliverable = false;
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    if (!DEFINITIVE_MISS.has(code)) {
      // Timeout / DNS failure: fail open, and don't cache the guess.
      return true;
    }
    // No MX: RFC 5321 lets a bare address record receive mail, so check that before rejecting.
    const verdict = await hostResolves(domain);
    if (verdict === "unknown") return true;
    deliverable = verdict === "public";
  }

  domainCache.set(domain, { deliverable, until: Date.now() + CACHE_TTL_MS });
  if (domainCache.size > 5000) domainCache.clear();
  return deliverable;
}

// ---------------------------------------------------------------- 5. mailbox verification service

export type MailboxVerdict = "deliverable" | "undeliverable" | "disposable" | "unknown";

const mailboxCache = new Map<string, { verdict: MailboxVerdict; until: number }>();
const MAILBOX_CACHE_MS = 24 * 60 * 60 * 1000;
const MAILBOX_TIMEOUT_MS = 5000;

export function mailboxVerificationProvider(): string | null {
  const provider = (process.env.EMAIL_VERIFICATION_PROVIDER ?? "").trim().toLowerCase();
  return provider && process.env.EMAIL_VERIFICATION_API_KEY ? provider : null;
}

/** Reads each service's answer into one of four verdicts. Only clear answers count; everything else is "unknown". */
export function interpretMailboxResponse(provider: string, body: Record<string, unknown>): MailboxVerdict {
  switch (provider) {
    case "kickbox":
      if (body.disposable === true) return "disposable";
      if (body.result === "deliverable") return "deliverable";
      if (body.result === "undeliverable") return "undeliverable";
      return "unknown";
    case "zerobounce": {
      const status = String(body.status ?? "").toLowerCase();
      const sub = String(body.sub_status ?? "").toLowerCase();
      if (sub === "disposable" || sub === "toxic") return "disposable";
      if (status === "valid") return "deliverable";
      if (status === "invalid" || status === "spamtrap") return "undeliverable";
      return "unknown";
    }
    case "abstract": {
      const disposable = (body.is_disposable_email as { value?: boolean } | undefined)?.value;
      if (disposable === true) return "disposable";
      if (body.deliverability === "DELIVERABLE") return "deliverable";
      if (body.deliverability === "UNDELIVERABLE") return "undeliverable";
      return "unknown";
    }
    default:
      return "unknown";
  }
}

function mailboxUrl(provider: string, key: string, email: string): string | null {
  const e = encodeURIComponent(email);
  const k = encodeURIComponent(key);
  switch (provider) {
    case "kickbox":
      return `https://api.kickbox.com/v2/verify?email=${e}&apikey=${k}`;
    case "zerobounce":
      return `https://api.zerobounce.net/v2/validate?api_key=${k}&email=${e}&ip_address=`;
    case "abstract":
      return `https://emailvalidation.abstractapi.com/v1/?api_key=${k}&email=${e}`;
    default:
      return null;
  }
}

/**
 * Asks the configured verification service whether this exact mailbox exists.
 * "unknown" when no service is set up, or it is slow, down, out of credit, or unsure.
 */
export async function verifyMailbox(email: string): Promise<MailboxVerdict> {
  const provider = mailboxVerificationProvider();
  if (!provider) return "unknown";
  const normalized = normalizeEmail(email);
  // Cached under a hash so the cache itself doesn't hold a list of addresses.
  const key = createHash("sha256").update(normalized).digest("hex");
  const cached = mailboxCache.get(key);
  if (cached && cached.until > Date.now()) return cached.verdict;

  const url = mailboxUrl(provider, process.env.EMAIL_VERIFICATION_API_KEY!, normalized);
  if (!url) {
    logger.warn(`Unknown EMAIL_VERIFICATION_PROVIDER "${provider}" — use kickbox, zerobounce or abstract.`);
    return "unknown";
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(MAILBOX_TIMEOUT_MS) });
    if (!response.ok) {
      logger.warn(`Email verification service answered HTTP ${response.status}; accepting the address.`);
      return "unknown";
    }
    const verdict = interpretMailboxResponse(provider, (await response.json()) as Record<string, unknown>);
    if (verdict !== "unknown") {
      mailboxCache.set(key, { verdict, until: Date.now() + MAILBOX_CACHE_MS });
      if (mailboxCache.size > 5000) mailboxCache.clear();
    }
    return verdict;
  } catch (error) {
    logger.warn(`Email verification service unavailable (${error instanceof Error ? error.message : error}); accepting the address.`);
    return "unknown";
  }
}

// ---------------------------------------------------------------- the full check

export type EmailVerdict = { ok: true } | { ok: false; reason: string; suggestion?: string };

export interface EmailCheckOptions {
  /** Also ask the mailbox-verification service, if one is configured (accounts only — it costs credits). */
  verifyMailbox?: boolean;
}

/** The full check used by sign-up and forms. */
export async function checkEmailDeliverable(email: string, options: EmailCheckOptions = {}): Promise<EmailVerdict> {
  const normalized = normalizeEmail(email);
  if (!hasValidEmailShape(normalized)) return { ok: false, reason: "Enter a valid email address, like name@example.com." };
  const at = normalized.lastIndexOf("@");
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  const fixed = suggestDomainFix(domain);
  if (fixed) {
    const suggestion = `${local}@${fixed}`;
    return { ok: false, reason: `"${domain}" looks like a typo. Did you mean ${suggestion}?`, suggestion };
  }
  if (isDisposableEmail(normalized)) {
    return { ok: false, reason: "Temporary email addresses can't be used. Please use your regular email." };
  }
  if (!(await domainAcceptsMail(domain))) {
    return { ok: false, reason: `We couldn't find a mail server for "${domain}". Please check the spelling of your email.` };
  }

  if (options.verifyMailbox) {
    const mailbox = await verifyMailbox(normalized);
    if (mailbox === "undeliverable") {
      return { ok: false, reason: `The email provider for "${domain}" says this mailbox doesn't exist. Please check the address.` };
    }
    if (mailbox === "disposable") {
      return { ok: false, reason: "Temporary email addresses can't be used. Please use your regular email." };
    }
  }
  return { ok: true };
}

const REASON = Symbol("emailCheckReason");

/**
 * class-validator decorator for public forms: `@IsDeliverableEmail()` next to
 * `@IsEmail()` also rejects typo, throwaway and mail-less domains.
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
        async validate(value: unknown, args?: ValidationArguments) {
          // Shape errors are @IsEmail()'s job — don't double-report them.
          if (typeof value !== "string" || !value.includes("@")) return true;
          const verdict = await checkEmailDeliverable(value);
          // Kept on this request's own object so simultaneous requests never see each other's message.
          if (!verdict.ok && args) (args.object as Record<symbol, string>)[REASON] = verdict.reason;
          return verdict.ok;
        },
        defaultMessage(args?: ValidationArguments) {
          return (
            (args?.object as Record<symbol, string> | undefined)?.[REASON] ??
            "This email address doesn't look deliverable. Please check it and try again."
          );
        },
      },
    });
  };
}
