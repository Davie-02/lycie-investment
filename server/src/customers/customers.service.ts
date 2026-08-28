import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { CreateCustomerCaseDto } from "./dto/create-customer-case.dto";
import { CreateCustomerCaseUpdateDto } from "./dto/create-customer-case-update.dto";

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.customerUser.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("A customer with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customerUser.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          account: { create: {} },
        },
        select: CUSTOMER_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorUserId: customer.id,
          action: "CREATE",
          entityType: "CustomerUser",
          entityId: customer.id,
        },
      });
      return customer;
    });
  }

  async authenticate(email: string, password: string) {
    const customer = await this.prisma.customerUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const passwordMatches = customer ? await bcrypt.compare(password, customer.passwordHash) : false;

    if (!customer || !customer.isActive || !passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return { id: customer.id, name: customer.name, email: customer.email, role: "CUSTOMER" };
  }

  findCases(customerId: string) {
    return this.prisma.customerCase.findMany({
      where: { customerId },
      orderBy: { updatedAt: "desc" },
      include: {
        vehicle: { select: { make: true, model: true, year: true, images: true } },
        hireVehicle: { select: { name: true, image: true } },
        updates: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  createCase(dto: CreateCustomerCaseDto) {
    return this.prisma.customerCase.create({
      data: {
        customerId: dto.customerId,
        title: dto.title.trim(),
        details: dto.details?.trim(),
        vehicleId: dto.vehicleId,
        hireVehicleId: dto.hireVehicleId,
        status: dto.status,
      },
    });
  }

  addCaseUpdate(caseId: string, dto: CreateCustomerCaseUpdateDto) {
    return this.prisma.$transaction(async (tx) => {
      const customerCase = await tx.customerCase.findUnique({ where: { id: caseId } });
      if (!customerCase) throw new NotFoundException("Customer case not found.");

      const update = await tx.customerCaseUpdate.create({
        data: { caseId, status: dto.status, message: dto.message.trim() },
      });
      await tx.customerCase.update({ where: { id: caseId }, data: { status: dto.status } });
      return update;
    });
  }
}