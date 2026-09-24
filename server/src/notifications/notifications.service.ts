/**
 * One place to tell a customer something: always by email, and also by
 * WhatsApp when it's set up and we have their phone number (most of our
 * customers read WhatsApp first). Never throws — a failed notification must
 * not undo the work that triggered it.
 */
import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "../email/email.service";
import { sendWhatsApp, whatsappConfigured } from "./whatsapp";

export interface CustomerNotice {
  email?: string | null;
  phone?: string | null;
  /** "whatsapp" | "email" | "phone" … as chosen on forms; WhatsApp is sent whenever a phone is known unless they chose email only. */
  preferredContact?: string | null;
  subject: string;
  html: string;
  /** Short plain text for WhatsApp (one message). */
  text: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly email: EmailService) {}

  get whatsappReady(): boolean {
    return whatsappConfigured();
  }

  async notify(notice: CustomerNotice): Promise<{ email: boolean; whatsapp: boolean }> {
    const result = { email: false, whatsapp: false };
    if (notice.email) {
      try {
        result.email = (await this.email.sendChecked({ to: notice.email, subject: notice.subject, html: notice.html })).ok;
      } catch (error) {
        this.logger.warn(`Email notification failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (notice.phone && this.whatsappReady && notice.preferredContact !== "email") {
      const sent = await sendWhatsApp(notice.phone, notice.text);
      result.whatsapp = sent.ok;
      if (!sent.ok) this.logger.warn(`WhatsApp notification failed: ${sent.error}`);
    }
    return result;
  }
}
