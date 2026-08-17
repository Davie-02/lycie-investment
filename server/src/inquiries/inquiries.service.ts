import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";

@Injectable()
export class InquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateInquiryDto) {
    return this.prisma.inquiry.create({ data: dto });
  }

  findAll() {
    return this.prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
      include: { vehicle: { select: { make: true, model: true, year: true, slug: true } } },
    });
  }
}
