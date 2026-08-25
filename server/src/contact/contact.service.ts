import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { adminNewSubmissionEmail } from "../email/email-templates";
import { CreateContactMessageDto } from "./dto/create-contact-message.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateContactMessageDto) {
    const message = await this.prisma.contactMessage.create({ data: dto });

    const template = adminNewSubmissionEmail("contact message", [
      `${message.fullName} (${message.email}${message.phone ? `, ${message.phone}` : ""})`,
      `Subject: ${message.subject}`,
      `Message: ${message.message}`,
    ]);
    await this.emailService.notifyAdmin(template.subject, template.html);

    return message;
  }

  findAll() {
    return this.prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  }

  async updateStatus(id: string, dto: UpdateRequestStatusDto) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Contact message not found.");
    }
    return this.prisma.contactMessage.update({ where: { id }, data: { status: dto.status } });
  }
}
