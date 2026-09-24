import { Injectable, Logger } from "@nestjs/common";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export type EmailProvider = "resend" | "brevo" | "none";

export interface SendResult {
  ok: boolean;
  /** Human-readable reason when it didn't go through. */
  error?: string;
}

function parseAddress(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return match ? { name: match[1].trim() || undefined, email: match[2].trim() } : { email: from.trim() };
}

/**
 * Sends transactional email through Resend or Brevo (both plain HTTPS APIs —
 * important, because free hosting like Render blocks the normal SMTP ports).
 * Chosen by EMAIL_PROVIDER, or automatically from whichever API key is set.
 *
 * - Resend: needs a verified domain to email real customers (its sandbox only
 *   delivers to the account owner).
 * - Brevo: can send from a single verified sender address (e.g. a Gmail), no
 *   domain needed — fine to start, though a domain gives better inbox delivery.
 *
 * Unconfigured = every send logs a warning and returns { ok: false }, so local
 * development never needs an email account.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  get provider(): EmailProvider {
    const choice = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
    if (choice === "brevo" && process.env.BREVO_API_KEY) return "brevo";
    if (choice === "resend" && process.env.RESEND_API_KEY) return "resend";
    if (!choice) {
      if (process.env.BREVO_API_KEY) return "brevo";
      if (process.env.RESEND_API_KEY) return "resend";
    }
    return "none";
  }

  get isConfigured(): boolean {
    return this.provider !== "none";
  }

  get fromAddress(): string {
    return process.env.EMAIL_FROM || "Lycie Investments <onboarding@resend.dev>";
  }

  /**
   * Replies go here (e.g. the company inbox) even if the sending address is a no-reply.
   * Accepts "info@x.com" or "Name <info@x.com>", with or without stray quotes; anything
   * that isn't a valid address is ignored (with a warning) rather than making every
   * email fail — providers reject a malformed reply-to outright.
   */
  get replyTo(): string | undefined {
    const raw = (process.env.EMAIL_REPLY_TO ?? "").trim().replace(/^["']+|["']+$/g, "");
    if (!raw) return undefined;
    const { email } = parseAddress(raw);
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      if (!this.warnedReplyTo) {
        this.warnedReplyTo = true;
        this.logger.warn(`EMAIL_REPLY_TO ("${raw}") isn't a valid email address, so it is being ignored.`);
      }
      return undefined;
    }
    return email;
  }
  private warnedReplyTo = false;

  get adminNotificationEmail(): string | undefined {
    return process.env.ADMIN_NOTIFICATION_EMAIL;
  }

  /** Fire-and-forget style: never throws, never blocks the request that triggered it. */
  async send(input: SendEmailInput): Promise<void> {
    await this.sendChecked(input);
  }

  /** Like send(), but tells the caller whether it worked (used for admin-initiated emails and the test button). */
  async sendChecked({ to, subject, html }: SendEmailInput): Promise<SendResult> {
    const provider = this.provider;
    if (provider === "none") {
      this.logger.warn(`No email provider configured — skipping email "${subject}" to ${to}. Set RESEND_API_KEY or BREVO_API_KEY.`);
      return { ok: false, error: "Email isn't connected yet. A system administrator can see what's needed under System → Settings & status." };
    }

    try {
      const response =
        provider === "brevo" ? await this.sendBrevo(to, subject, html) : await this.sendResend(to, subject, html);
      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`${provider} API error (${response.status}) sending "${subject}" to ${to}: ${body}`);
        return { ok: false, error: this.explain(provider, response.status, body) };
      }
      return { ok: true };
    } catch (err) {
      // Email failures must never break the request that triggered them.
      this.logger.error(`Failed to send email "${subject}" to ${to}`, err);
      return { ok: false, error: "Couldn't reach the email service." };
    }
  }

  private sendResend(to: string, subject: string, html: string) {
    return fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.fromAddress, to, subject, html, ...(this.replyTo ? { reply_to: this.replyTo } : {}) }),
    });
  }

  private sendBrevo(to: string, subject: string, html: string) {
    const sender = parseAddress(this.fromAddress);
    return fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY as string, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(this.replyTo ? { replyTo: { email: this.replyTo } } : {}),
      }),
    });
  }

  private explain(provider: EmailProvider, status: number, body: string): string {
    // Providers explain themselves in JSON; quote that rather than guessing.
    let detail = "";
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: { message?: string } };
      detail = parsed.message ?? parsed.error?.message ?? "";
    } catch {
      detail = body.slice(0, 200);
    }
    if (status === 401 || status === 403) {
      return `The ${provider} API key or account was rejected${detail ? ` (${detail})` : ""}. Check the key, and any IP restrictions, in ${provider}.`;
    }
    if (provider === "resend" && /verify|domain|own email/i.test(detail || body)) {
      return "Resend only delivers to your own address until a domain is verified. Verify your domain in Resend, or switch to Brevo.";
    }
    if (provider === "brevo" && /sender/i.test(detail) && /valid|verif|exist|not found|unrecogni/i.test(detail)) {
      return `Brevo doesn't accept the sending address. Add and verify EMAIL_FROM as a sender in Brevo. (Brevo said: ${detail})`;
    }
    return `${provider === "brevo" ? "Brevo" : "Resend"} refused the message${detail ? `: ${detail}` : ` (HTTP ${status})`}.`;
  }

  async notifyAdmin(subject: string, html: string): Promise<void> {
    if (!this.adminNotificationEmail) {
      this.logger.warn(`ADMIN_NOTIFICATION_EMAIL not set — skipping admin notification "${subject}".`);
      return;
    }
    await this.send({ to: this.adminNotificationEmail, subject, html });
  }
}
