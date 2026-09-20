import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "./../content-admin/content-state";
import { CreateVehicleDto } from "./dto/create-vehicle.dto";
import { UpdateVehicleDto } from "./dto/update-vehicle.dto";

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 24) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where: PUBLIC.vehicles,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vehicle.count({ where: PUBLIC.vehicles }),
    ]);

    return { items, total, page, pageSize };
  }

  findFeatured(limit: number) {
    return this.prisma.vehicle.findMany({
      where: { ...PUBLIC.vehicles, status: "available" },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  async findBySlug(slug: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { slug, ...PUBLIC.vehicles } });
    if (!vehicle) {
      throw new NotFoundException(`No vehicle found with slug "${slug}".`);
    }
    return vehicle;
  }

  async create(dto: CreateVehicleDto) {
    const existing = await this.prisma.vehicle.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A vehicle with slug "${dto.slug}" already exists.`);
    }
    return this.prisma.vehicle.create({ data: dto });
  }

  async update(id: string, dto: UpdateVehicleDto) {
    await this.ensureExists(id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.vehicle.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`No vehicle found with id "${id}".`);
    }
  }
}
