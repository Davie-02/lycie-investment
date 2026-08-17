import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateImportRequestDto } from "./dto/create-import-request.dto";

@Injectable()
export class ImportRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateImportRequestDto) {
    return this.prisma.importRequest.create({ data: dto });
  }

  findAll() {
    return this.prisma.importRequest.findMany({ orderBy: { createdAt: "desc" } });
  }
}
