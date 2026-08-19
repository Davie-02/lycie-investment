import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateNoticeDto } from "./dto/create-notice.dto";
import { UpdateNoticeDto } from "./dto/update-notice.dto";

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  findActive() {
    return this.prisma.notice.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  findAll() {
    return this.prisma.notice.findMany({ orderBy: { createdAt: "desc" } });
  }

  create(dto: CreateNoticeDto) {
    return this.prisma.notice.create({ data: dto });
  }

  async update(id: string, dto: UpdateNoticeDto) {
    await this.ensureExists(id);
    return this.prisma.notice.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.notice.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice) {
      throw new NotFoundException(`No notice found with id "${id}".`);
    }
  }
}
