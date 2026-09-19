import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { analyzeText } from "../insights/sentiment.util";
import { redactPii } from "./pii.util";
import { CreateSubmissionDto, SubmissionKind } from "./dto/submission.dto";

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubmissionDto): Promise<{ received: true }> {
    // Personal details are stripped before anything is stored — the form
    // tells visitors not to include them, and this catches slips.
    const message = redactPii(dto.message.trim());
    const sentiment = dto.kind === "comment" ? analyzeText(message) : null;

    await this.prisma.visitorSubmission.create({
      data: {
        kind: dto.kind,
        message,
        sentiment: sentiment?.label ?? null,
        sentimentScore: sentiment?.score ?? null,
      },
    });
    return { received: true };
  }

  async list(kind?: SubmissionKind, status?: "new" | "handled") {
    const [items, newCount] = await Promise.all([
      this.prisma.visitorSubmission.findMany({
        where: { ...(kind ? { kind } : {}), ...(status ? { status } : {}) },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.visitorSubmission.count({ where: { status: "new" } }),
    ]);
    return { items, newCount };
  }

  async setStatus(id: string, status: "new" | "handled") {
    await this.ensure(id);
    return this.prisma.visitorSubmission.update({ where: { id }, data: { status } });
  }

  async remove(id: string): Promise<void> {
    await this.ensure(id);
    await this.prisma.visitorSubmission.delete({ where: { id } });
  }

  private async ensure(id: string) {
    const row = await this.prisma.visitorSubmission.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException("Message not found.");
  }
}
