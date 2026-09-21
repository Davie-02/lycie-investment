/**
 * Finds positive approved reviews worth turning into testimonials (scan), then lets an
 * admin publish one as a real testimonial or dismiss it.
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { Candidate, isTestimonialWorthy, rankScore } from "./testimonial-ideas.util";

export class PublishIdeaDto {
  @IsOptional() @IsString() @MinLength(10) @MaxLength(500) quote?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) authorName?: string;
  @IsOptional() @IsString() @MaxLength(80) authorTitle?: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
}

@Injectable()
export class TestimonialIdeasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Looks through approved reviews and positive visitor comments for testimonial-worthy quotes not yet suggested. */
  async scan(): Promise<{ found: number; created: number }> {
    const [reviews, comments, existing] = await Promise.all([
      this.prisma.review.findMany({
        where: { status: "approved", sentiment: "positive" },
        select: { id: true, comment: true, authorName: true, rating: true, sentimentScore: true },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      this.prisma.visitorSubmission.findMany({
        where: { kind: "comment", sentiment: "positive" },
        select: { id: true, message: true, sentimentScore: true },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      this.prisma.testimonialIdea.findMany({ select: { source: true, sourceId: true } }),
    ]);
    const seen = new Set(existing.map((e) => `${e.source}:${e.sourceId}`));

    const candidates: Candidate[] = [
      ...reviews.map((r) => ({
        source: "review" as const,
        sourceId: r.id,
        text: r.comment,
        authorName: r.authorName,
        rating: r.rating,
        sentimentScore: r.sentimentScore,
      })),
      ...comments.map((c) => ({
        source: "comment" as const,
        sourceId: c.id,
        text: c.message,
        authorName: "Website visitor",
        rating: null,
        sentimentScore: c.sentimentScore ?? 0,
      })),
    ].filter((c) => !seen.has(`${c.source}:${c.sourceId}`));

    const worthy = candidates.filter(isTestimonialWorthy);
    if (worthy.length) {
      await this.prisma.testimonialIdea.createMany({
        data: worthy.map((c) => ({
          source: c.source,
          sourceId: c.sourceId,
          quote: c.text.trim(),
          authorName: c.authorName,
          rating: c.rating,
          score: rankScore(c),
        })),
        skipDuplicates: true,
      });
    }
    return { found: candidates.length, created: worthy.length };
  }

  list(status: "pending" | "published" | "dismissed" = "pending") {
    return this.prisma.testimonialIdea.findMany({ where: { status }, orderBy: [{ score: "desc" }, { createdAt: "desc" }], take: 100 });
  }

  async publish(id: string, dto: PublishIdeaDto) {
    const idea = await this.ensurePending(id);
    const testimonial = await this.prisma.$transaction(async (tx) => {
      const created = await tx.testimonial.create({
        data: {
          quote: (dto.quote ?? idea.quote).trim(),
          authorName: (dto.authorName ?? idea.authorName).trim(),
          authorTitle: dto.authorTitle?.trim() || (idea.source === "review" ? "Customer review" : null),
          rating: dto.rating ?? idea.rating ?? 5,
          isPublished: true,
        },
      });
      await tx.testimonialIdea.update({ where: { id }, data: { status: "published" } });
      return created;
    });
    return testimonial;
  }

  async dismiss(id: string) {
    await this.ensurePending(id);
    return this.prisma.testimonialIdea.update({ where: { id }, data: { status: "dismissed" } });
  }

  private async ensurePending(id: string) {
    const idea = await this.prisma.testimonialIdea.findUnique({ where: { id } });
    if (!idea) throw new NotFoundException("Idea not found.");
    if (idea.status !== "pending") throw new BadRequestException("This idea has already been reviewed.");
    return idea;
  }
}
