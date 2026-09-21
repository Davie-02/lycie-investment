/**
 * Database access for FAQ entries; the public list returns only published, non-archived
 * ones.
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "../content-admin/content-state";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 100) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.faq.findMany({
        where: PUBLIC.faq,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.faq.count({ where: PUBLIC.faq }),
    ]);

    return { items, total, page, pageSize };
  }

  create(dto: CreateFaqDto) {
    return this.prisma.faq.create({ data: dto });
  }

  async update(id: string, dto: UpdateFaqDto) {
    await this.ensureExists(id);
    return this.prisma.faq.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.faq.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) {
      throw new NotFoundException(`No FAQ found with id "${id}".`);
    }
  }
}
