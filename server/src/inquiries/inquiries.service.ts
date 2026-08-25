import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { adminNewSubmissionEmail } from "../email/email-templates";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateInquiryDto) {
    const inquiry = await this.prisma.inquiry.create({
      data: dto,
      include: { vehicle: { select: { make: true, model: true, year: true } } },
    });

    const template = adminNewSubmissionEmail("vehicle inquiry", [
      `${inquiry.fullName} (${inquiry.phone}, ${inquiry.email})`,
      inquiry.vehicle
        ? `Vehicle: ${inquiry.vehicle.make} ${inquiry.vehicle.model} (${inquiry.vehicle.year})`
        : "No specific vehicle referenced",
      inquiry.message ? `Message: ${inquiry.message}` : "No message included",
    ]);
    await this.emailService.notifyAdmin(template.subject, template.html);

    return inquiry;
  }

  findAll() {
    return this.prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: { vehicle: { select: { make: true, model: true, year: true, slug: true } } },
    });
  }

  async updateStatus(id: string, dto: UpdateRequestStatusDto) {
    const existing = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Inquiry not found.");
    }
    return this.prisma.inquiry.update({ where: { id }, data: { status: dto.status } });
  }
}
