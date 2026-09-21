/**
 * Database access for testimonials. The public list only returns items that are
 * published and not archived (rules in content-admin/content-state.ts).
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "../content-admin/content-state";
import { CreateTestimonialDto } from "./dto/create-testimonial.dto";
import { UpdateTestimonialDto } from "./dto/update-testimonial.dto";

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 100) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.testimonial.findMany({
        where: PUBLIC.testimonials,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.testimonial.count({ where: PUBLIC.testimonials }),
    ]);

    return { items, total, page, pageSize };
  }

  create(dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({ data: dto });
  }

  async update(id: string, dto: UpdateTestimonialDto) {
    await this.ensureExists(id);
    return this.prisma.testimonial.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.testimonial.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const testimonial = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException(`No testimonial found with id "${id}".`);
    }
  }
}
