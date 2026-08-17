import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateClearingRequestDto } from "./dto/create-clearing-request.dto";

@Injectable()
export class ClearingRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateClearingRequestDto) {
    return this.prisma.clearingRequest.create({
      data: {
        ...dto,
        expectedArrivalDate: dto.expectedArrivalDate ? new Date(dto.expectedArrivalDate) : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.clearingRequest.findMany({ orderBy: { createdAt: "desc" } });
  }
}
