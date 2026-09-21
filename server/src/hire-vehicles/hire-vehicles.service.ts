import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "../content-admin/content-state";
import { CreateHireVehicleDto } from "./dto/create-hire-vehicle.dto";
import { UpdateHireVehicleDto } from "./dto/update-hire-vehicle.dto";

/**
 * A hire vehicle stores its photos twice: `images` (the whole gallery) and
 * `image` (the cover — always the first gallery image). Older code and simple
 * lists read `image`; the site's sliders read `images`. This keeps the two in
 * step whichever the caller sent, so they can never disagree.
 */
function withGallery<T extends { image?: string; images?: string[] }>(dto: T): T & { image?: string; images?: string[] } {
  if (dto.images && dto.images.length > 0) return { ...dto, image: dto.images[0] };
  if (dto.image) return { ...dto, images: [dto.image] };
  return dto;
}

@Injectable()
export class HireVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, pageSize = 24) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.hireVehicle.findMany({
        where: PUBLIC["hire-vehicles"],
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.hireVehicle.count({ where: PUBLIC["hire-vehicles"] }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(dto: CreateHireVehicleDto) {
    const existing = await this.prisma.hireVehicle.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A hire vehicle with slug "${dto.slug}" already exists.`);
    }
    const data = withGallery(dto);
    if (!data.image) throw new BadRequestException("Add at least one image.");
    return this.prisma.hireVehicle.create({ data: { ...data, image: data.image } });
  }

  async update(id: string, dto: UpdateHireVehicleDto) {
    await this.ensureExists(id);
    return this.prisma.hireVehicle.update({ where: { id }, data: withGallery(dto) });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.hireVehicle.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const vehicle = await this.prisma.hireVehicle.findUnique({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`No hire vehicle found with id "${id}".`);
    }
  }
}
