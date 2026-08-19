import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSiteContentDto } from "./dto/update-site-content.dto";

@Injectable()
export class SiteContentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns every section merged into a single { [key]: value } object,
   * e.g. { contact: {...}, social: {...}, about: {...} }. The frontend
   * reads this once and treats missing keys as "use the built-in default"
   * — see src/context/SiteContentContext.tsx — so a fresh database with no
   * seeded content yet doesn't break the site, just falls back gracefully.
   */
  async findAll(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.siteContent.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  upsert(key: string, dto: UpdateSiteContentDto) {
    // Prisma's Json column expects Prisma.InputJsonValue, not the DTO's
    // Record<string, unknown> — class-validator's @IsObject() already
    // confirmed this is a plain object at runtime, so the cast is safe.
    const value = dto.value as Prisma.InputJsonValue;
    return this.prisma.siteContent.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
