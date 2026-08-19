import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHireVehicleDto } from "./dto/create-hire-vehicle.dto";
import { UpdateHireVehicleDto } from "./dto/update-hire-vehicle.dto";

@Injectable()
export class HireVehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.hireVehicle.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateHireVehicleDto) {
    const existing = await this.prisma.hireVehicle.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`A hire vehicle with slug "${dto.slug}" already exists.`);
    }
    return this.prisma.hireVehicle.create({ data: dto });
  }

  async update(id: string, dto: UpdateHireVehicleDto) {
    await this.ensureExists(id);
    return this.prisma.hireVehicle.update({ where: { id }, data: dto });
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
