import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSiteContentDto } from "./dto/update-site-content.dto";
import { COMPANY_PROFILE } from "./company-profile";

@Injectable()
export class SiteContentService implements OnModuleInit {
  private readonly logger = new Logger(SiteContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Makes sure every company-profile section (team, fleet, clients, vision…) exists
   * as ordinary stored content, so a fresh or older database shows the same pages
   * as everywhere else. Only sections with no saved row are added — anything already
   * saved, including edits made in the admin, is never touched.
   */
  async onModuleInit(): Promise<void> {
    try {
      const created = await this.seedMissingProfileSections();
      if (created.length > 0) this.logger.log(`Added missing site content sections: ${created.join(", ")}`);
    } catch (error) {
      // Never block startup over seed content — the admin can still load it manually.
      this.logger.warn(`Could not add default site content: ${(error as Error).message}`);
    }
  }

  async seedMissingProfileSections(): Promise<string[]> {
    const existing = new Set((await this.prisma.siteContent.findMany({ select: { key: true } })).map((row) => row.key));
    const missing = Object.keys(COMPANY_PROFILE).filter((key) => !existing.has(key));
    if (missing.length === 0) return [];
    await this.prisma.siteContent.createMany({
      data: missing.map((key) => ({ key, value: COMPANY_PROFILE[key] as Prisma.InputJsonValue })),
      skipDuplicates: true,
    });
    return missing;
  }

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

  /**
   * Loads the company profile into the CMS. Each section is merged over what's
   * already saved: fields the profile defines are replaced, other saved fields
   * (business hours, WhatsApp number, social links…) are kept.
   */
  async applyCompanyProfile(): Promise<{ sections: string[] }> {
    const existing = await this.findAll();
    const sections = Object.keys(COMPANY_PROFILE);
    await this.prisma.$transaction(
      sections.map((key) => {
        const current = (existing[key] && typeof existing[key] === "object" && !Array.isArray(existing[key]) ? existing[key] : {}) as Record<string, unknown>;
        const value = { ...current, ...COMPANY_PROFILE[key] } as Prisma.InputJsonValue;
        return this.prisma.siteContent.upsert({ where: { key }, update: { value }, create: { key, value } });
      })
    );
    return { sections };
  }
}
