import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { profileMessageNotificationEmail, staffMessageEmail } from "../email/email-templates";
import { PreferredContact } from "../common/preferred-contact";
import { RequestType } from "./dto/contact.dto";

interface RequestRecord {
  fullName: string;
  phone: string | null;
  email: string;
  customerId: string | null;
  preferredContact: string | null;
  status: string;
}

/**
 * Everything staff need to answer a customer from the admin, whichever way the
 * customer asked to be reached — one place for every kind of request. The
 * recipient address always comes from the stored request, never from the
 * browser, so this can't be used to email arbitrary people.
 */
@Injectable()
export class ContactAdminService {
  private readonly logger = new Logger(ContactAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService
  ) {}

  private async load(type: RequestType, id: string): Promise<RequestRecord> {
    const select = { fullName: true, phone: true, email: true, customerId: true, preferredContact: true, status: true };
    const row =
      type === "inquiry"
        ? await this.prisma.inquiry.findUnique({ where: { id }, select })
        : type === "import"
          ? await this.prisma.importRequest.findUnique({ where: { id }, select })
          : type === "clearing"
            ? await this.prisma.clearingRequest.findUnique({ where: { id }, select })
            : type === "hire"
              ? await this.prisma.hireRequest.findUnique({ where: { id }, select })
              : await this.prisma.contactMessage.findUnique({ where: { id }, select });
    if (!row) throw new NotFoundException("Request not found.");
    return row;
  }

  private async adminName(adminId: string): Promise<string> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId }, select: { name: true } });
    return admin?.name ?? "Lycie team";
  }

  /** Marks a fresh request as "contacted" once anyone has reached out. */
  private async markContacted(type: RequestType, id: string, current: string): Promise<void> {
    if (current !== "new") return;
    const data = { status: "contacted" };
    if (type === "inquiry") await this.prisma.inquiry.update({ where: { id }, data });
    else if (type === "import") await this.prisma.importRequest.update({ where: { id }, data });
    else if (type === "clearing") await this.prisma.clearingRequest.update({ where: { id }, data });
    else if (type === "contact") await this.prisma.contactMessage.update({ where: { id }, data });
    // hire requests use pending/confirmed/… — reaching out doesn't change their status.
  }

  async history(type: RequestType, id: string) {
    const [record, logs] = await Promise.all([
      this.load(type, id),
      this.prisma.contactLog.findMany({ where: { requestType: type, requestId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return { logs, canMessageProfile: Boolean(record.customerId), preferredContact: record.preferredContact };
  }

  async log(type: RequestType, id: string, adminId: string, method: PreferredContact, note?: string) {
    const record = await this.load(type, id);
    const entry = await this.prisma.contactLog.create({
      data: { requestType: type, requestId: id, method, note: note?.trim() || null, adminName: await this.adminName(adminId) },
    });
    await this.markContacted(type, id, record.status);
    return entry;
  }

  async sendEmail(type: RequestType, id: string, adminId: string, subject: string, body: string) {
    const record = await this.load(type, id);
    const adminName = await this.adminName(adminId);
    const template = staffMessageEmail({ customerName: record.fullName, subject, body, signOff: adminName });
    const result = await this.email.sendChecked({ to: record.email, ...template });
    if (!result.ok) throw new UnprocessableEntityException(result.error ?? "The email couldn't be sent.");
    await this.log(type, id, adminId, "email", `Subject: ${subject}`);
    return { sent: true, to: record.email };
  }

  async sendProfileMessage(type: RequestType, id: string, adminId: string, subject: string, body: string) {
    const record = await this.load(type, id);
    if (!record.customerId) {
      throw new BadRequestException(
        "This person submitted without signing in, so they have no Lycie profile to message. Use WhatsApp, a call or email instead."
      );
    }
    const adminName = await this.adminName(adminId);
    const message = await this.prisma.customerMessage.create({
      data: { customerId: record.customerId, subject, body, requestType: type, requestId: id, sentByName: adminName },
    });

    // A heads-up email is a courtesy — the message is delivered either way.
    const frontend = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const notice = profileMessageNotificationEmail({ customerName: record.fullName, subject, accountUrl: `${frontend}/account/messages` });
    void this.email.send({ to: record.email, ...notice }).catch((err) => this.logger.warn(`Notification email failed: ${err}`));

    await this.log(type, id, adminId, "message", `Subject: ${subject}`);
    return { delivered: true, id: message.id };
  }

  emailStatus() {
    return { provider: this.email.provider, configured: this.email.isConfigured, from: this.email.fromAddress, replyTo: this.email.replyTo ?? null };
  }

  async sendTestEmail(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId }, select: { email: true, name: true } });
    if (!admin) throw new NotFoundException("Admin not found.");
    const template = staffMessageEmail({
      customerName: admin.name,
      subject: "Test email from Lycie Investments",
      body: "This is a test. If you can read it, your website can send email — password resets, booking confirmations and messages to customers will be delivered.",
      signOff: "Your website",
    });
    const result = await this.email.sendChecked({ to: admin.email, ...template });
    if (!result.ok) throw new UnprocessableEntityException(result.error ?? "The test email couldn't be sent.");
    return { sent: true, to: admin.email };
  }
}
