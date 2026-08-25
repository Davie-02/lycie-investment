import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { adminNewSubmissionEmail } from "../email/email-templates";
import { CreateImportRequestDto } from "./dto/create-import-request.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";

@Injectable()
export class ImportRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateImportRequestDto) {
    const request = await this.prisma.importRequest.create({ data: dto });

    const template = adminNewSubmissionEmail("import request", [
      `${request.fullName} (${request.phone}, ${request.email})`,
      `Preferred: ${request.preferredMake} ${request.preferredModel ?? ""}`.trim(),
      request.budget ? `Budget: ${request.budget.toLocaleString()}` : "No budget specified",
    ]);
    await this.emailService.notifyAdmin(template.subject, template.html);

    return request;
  }

  findAll() {
    return this.prisma.importRequest.findMany({ orderBy: { createdAt: "desc" } });
  }

  async updateStatus(id: string, dto: UpdateRequestStatusDto) {
    const existing = await this.prisma.importRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Import request not found.");
    }
    return this.prisma.importRequest.update({ where: { id }, data: { status: dto.status } });
  }
}
