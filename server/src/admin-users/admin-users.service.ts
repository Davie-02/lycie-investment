import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";
import { runSerializable } from "../common/run-serializable";

// Fields that are safe to return from the API — never includes
// passwordHash. Every read/write below uses this instead of Prisma's
// default "return everything" behavior, so a future field added to the
// AdminUser model can never accidentally leak into an API response.
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
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.adminUser.create({
        data: { name: dto.name, email: dto.email, passwordHash, role: dto.role },
        select: SAFE_SELECT,
      });
    } catch (err) {
      // Relying on the database's own unique constraint on `email` here
      // (rather than a separate "does this email already exist?" check
      // beforehand) is deliberate — a check-then-write has the same race
      // condition described in run-serializable.ts. We let Postgres be the
      // single source of truth and just translate its rejection (error
      // code P2002 = unique constraint violation) into a clean message.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("An admin account with this email already exists.");
      }
      throw err;
    }
  }

  /**
   * Updates an admin account's name, role, active status, and/or password.
   *
   * The "don't strand the account with no Owner" check (count active
   * Owners, then demote/deactivate) is wrapped in a Serializable
   * transaction together with the actual write — see run-serializable.ts
   * for why a plain check-then-write here would be unsafe under
   * concurrency (two Owners could both pass the check at once).
   */
  async update(id: string, dto: UpdateAdminUserDto) {
    return runSerializable(this.prisma, async (tx) => {
      const target = await tx.adminUser.findUnique({ where: { id } });
      if (!target) {
        throw new NotFoundException("Admin user not found.");
      }

      const isDemotingOrDeactivatingOwner =
        target.role === "OWNER" &&
        ((dto.role && dto.role !== "OWNER") || dto.isActive === false);

      if (isDemotingOrDeactivatingOwner) {
        const ownerCount = await tx.adminUser.count({ where: { role: "OWNER", isActive: true } });
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

      return tx.adminUser.update({ where: { id }, data, select: SAFE_SELECT });
    });
  }

  /**
   * Deletes an admin account. Same "protect the last Owner" logic as
   * update(), same reason it needs to be inside one atomic transaction.
   */
  async remove(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestException("You can't delete your own account while logged in as it.");
    }

    return runSerializable(this.prisma, async (tx) => {
      const target = await tx.adminUser.findUnique({ where: { id } });
      if (!target) {
        throw new NotFoundException("Admin user not found.");
      }

      if (target.role === "OWNER") {
        const ownerCount = await tx.adminUser.count({ where: { role: "OWNER" } });
        if (ownerCount <= 1) {
          throw new BadRequestException("You can't delete the only Owner account.");
        }
      }

      await tx.adminUser.delete({ where: { id } });
      return { deleted: true };
    });
  }
}
