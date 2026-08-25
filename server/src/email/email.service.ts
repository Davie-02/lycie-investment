import { Injectable, Logger } from "@nestjs/common";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Wraps Resend's REST API directly via fetch rather than adding their SDK
 * as a dependency — this project sends a handful of simple transactional
 * emails, not enough to justify the extra package.
 *
 * If RESEND_API_KEY isn't set, every send() call logs a warning and returns
 * without sending — the same "graceful no-op when unconfigured" pattern
 * used for S3 image storage, so local development doesn't require a real
 * email account just to run the app.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private get apiKey(): string | undefined {
    return process.env.RESEND_API_KEY;
  }

  private get fromAddress(): string {
    return process.env.EMAIL_FROM || "Lycie Investment <onboarding@resend.dev>";
  }

  get adminNotificationEmail(): string | undefined {
    return process.env.ADMIN_NOTIFICATION_EMAIL;
  }

  async send({ to, subject, html }: SendEmailInput): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipping email "${subject}" to ${to}. Set it in .env to enable real sending.`
      );
      return;
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: this.fromAddress, to, subject, html }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`Resend API error (${response.status}) sending "${subject}" to ${to}: ${body}`);
      }
    } catch (err) {
      // Email failures should never break the actual request (form
      // submission, status update, etc.) that triggered them — log and
      // move on rather than throwing.
      this.logger.error(`Failed to send email "${subject}" to ${to}`, err);
    }
  }

  async notifyAdmin(subject: string, html: string): Promise<void> {
    if (!this.adminNotificationEmail) {
      this.logger.warn(
        `ADMIN_NOTIFICATION_EMAIL not set — skipping admin notification "${subject}".`
      );
      return;
    }
    await this.send({ to: this.adminNotificationEmail, subject, html });
  }
}
