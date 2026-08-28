import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";

const CUSTOMER_SELECT = { id: true, name: true, email: true, isActive: true, createdAt: true } as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterCustomerDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.customerUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException("A customer with this email already exists.");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customerUser.create({
        data: { name: dto.name.trim(), email, passwordHash, account: { create: {} } },
        select: CUSTOMER_SELECT,
      });
      await tx.auditLog.create({
        data: { actorUserId: customer.id, action: "CREATE", entityType: "CustomerUser", entityId: customer.id },
      });
      return customer;
    });
  }

  async authenticate(email: string, password: string) {
    const customer = await this.prisma.customerUser.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!customer || !customer.isActive || !(await bcrypt.compare(password, customer.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }
    return { id: customer.id, name: customer.name, email: customer.email, role: "CUSTOMER" };
  }
}