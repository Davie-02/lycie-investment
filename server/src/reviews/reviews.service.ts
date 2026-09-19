import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { adminNewSubmissionEmail } from "../email/email-templates";
import { analyzeReview } from "../insights/sentiment.util";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewStatus } from "./dto/update-review-status.dto";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateReviewDto, customerId?: string) {
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
      if (!vehicle) throw new BadRequestException("The vehicle being reviewed could not be found.");
    }

    const sentiment = analyzeReview(dto.comment, dto.rating);
    const review = await this.prisma.review.create({
      data: {
        authorName: dto.authorName,
        rating: dto.rating,
        comment: dto.comment,
        vehicleId: dto.vehicleId,
        customerId,
        // Always starts pending — nothing a visitor writes is published
        // until a human has read it.
        status: "pending",
        sentiment: sentiment.label,
        sentimentScore: sentiment.score,
        keywords: sentiment.keywords,
      },
      select: { id: true, status: true },
    });

    const email = adminNewSubmissionEmail("review", [
      `${dto.authorName} — ${dto.rating}/5 (${sentiment.label})`,
      dto.comment.length > 200 ? `${dto.comment.slice(0, 200)}…` : dto.comment,
    ]);
    await this.emailService.notifyAdmin(email.subject, email.html);

    return review;
  }

  /**
   * Approved reviews only, and only the fields safe to show the public —
   * never the customer link, sentiment score, or keywords. With no
   * vehicleId this is the company-wide review list.
   */
  async listPublic(vehicleId: string | undefined, page: number, pageSize: number) {
    const where = { status: "approved", vehicleId: vehicleId ?? null };

    const [items, total, aggregate] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, authorName: true, rating: true, comment: true, createdAt: true },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.aggregate({ where, _avg: { rating: true } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      averageRating: aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
    };
  }

  async listAdmin(status: ReviewStatus | undefined, page: number, pageSize: number) {
    const where = status ? { status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { vehicle: { select: { make: true, model: true, year: true, slug: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async updateStatus(id: string, status: ReviewStatus) {
    await this.ensureExists(id);
    return this.prisma.review.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.review.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException("Review not found.");
  }
}
