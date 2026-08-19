import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.adminUser.findMany({
      select: SAFE_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async create(dto: CreateAdminUserDto) {
    const existing = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("An admin account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.adminUser.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateAdminUserDto) {
    const target = await this.findByIdOrThrow(id);

    // Prevent removing the last Owner's access — either by demoting them
    // or deactivating them — which would lock everyone out of user
    // management entirely with no way back in except direct DB access.
    const isDemotingOrDeactivatingOwner =
      target.role === "OWNER" &&
      ((dto.role && dto.role !== "OWNER") || dto.isActive === false);

    if (isDemotingOrDeactivatingOwner) {
      const ownerCount = await this.prisma.adminUser.count({
        where: { role: "OWNER", isActive: true },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException(
          "This is the only active Owner account — promote another account to Owner first."
        );
      }
    }

    const data: Prisma.AdminUserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.adminUser.update({
      where: { id },
      data,
      select: SAFE_SELECT,
    });
  }

  async remove(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestException("You can't delete your own account while logged in as it.");
    }

    const target = await this.findByIdOrThrow(id);

    if (target.role === "OWNER") {
      const ownerCount = await this.prisma.adminUser.count({ where: { role: "OWNER" } });
      if (ownerCount <= 1) {
        throw new BadRequestException("You can't delete the only Owner account.");
      }
    }

    await this.prisma.adminUser.delete({ where: { id } });
    return { deleted: true };
  }

  private async findByIdOrThrow(id: string) {
    const user = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("Admin user not found.");
    }
    return user;
  }
}
