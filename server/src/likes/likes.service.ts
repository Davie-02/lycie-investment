import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "../content-admin/content-state";
import { LikeKind, SetLikeDto } from "./dto/like.dto";

@Injectable()
export class LikesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only live content can be liked, so likes can't be used to probe for hidden items. */
  private async exists(kind: LikeKind, id: string): Promise<boolean> {
    switch (kind) {
      case "vehicle":
        return Boolean(await this.prisma.vehicle.findFirst({ where: { id, ...PUBLIC.vehicles }, select: { id: true } }));
      case "hire":
        return Boolean(await this.prisma.hireVehicle.findFirst({ where: { id, ...PUBLIC["hire-vehicles"] }, select: { id: true } }));
      case "blog":
        return Boolean(await this.prisma.blogPost.findFirst({ where: { id, ...PUBLIC["blog-posts"] }, select: { id: true } }));
    }
  }

  async set(dto: SetLikeDto): Promise<{ count: number }> {
    if (!(await this.exists(dto.kind, dto.targetId))) throw new NotFoundException("Nothing to like here.");

    const key = { kind: dto.kind, targetId: dto.targetId, visitorId: dto.visitorId };
    if (dto.liked) {
      // Idempotent: liking twice from one browser is still one like.
      await this.prisma.contentLike.upsert({ where: { kind_targetId_visitorId: key }, create: key, update: {} });
    } else {
      await this.prisma.contentLike.deleteMany({ where: key });
    }
    const count = await this.prisma.contentLike.count({ where: { kind: dto.kind, targetId: dto.targetId } });
    return { count };
  }

  /** Like counts for a batch of items in one query. */
  async counts(kind: LikeKind, ids: string[]): Promise<Record<string, number>> {
    if (ids.length === 0) return {};
    const rows = await this.prisma.contentLike.groupBy({
      by: ["targetId"],
      where: { kind, targetId: { in: ids } },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.targetId, row._count._all]));
  }
}
