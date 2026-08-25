import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { adminNewSubmissionEmail } from "../email/email-templates";
import { CreateClearingRequestDto } from "./dto/create-clearing-request.dto";
import { UpdateRequestStatusDto } from "../common/dto/update-request-status.dto";

@Injectable()
export class ClearingRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateClearingRequestDto) {
    const request = await this.prisma.clearingRequest.create({
      data: {
        ...dto,
        expectedArrivalDate: dto.expectedArrivalDate ? new Date(dto.expectedArrivalDate) : undefined,
      },
    });

    const template = adminNewSubmissionEmail("clearing request", [
      `${request.fullName} (${request.phone}, ${request.email})`,
      `Vehicle: ${request.vehicleMake} ${request.vehicleModel ?? ""}`.trim(),
      `VIN: ${request.vin}`,
      `Current location: ${request.currentLocation}`,
    ]);
    await this.emailService.notifyAdmin(template.subject, template.html);

    return request;
  }

  findAll() {
    return this.prisma.clearingRequest.findMany({ orderBy: { createdAt: "desc" } });
  }

  async updateStatus(id: string, dto: UpdateRequestStatusDto) {
    const existing = await this.prisma.clearingRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Clearing request not found.");
    }
    return this.prisma.clearingRequest.update({ where: { id }, data: { status: dto.status } });
  }
}
