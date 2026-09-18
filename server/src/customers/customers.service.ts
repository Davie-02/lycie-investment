import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { passwordResetEmail } from "../email/email-templates";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { CreateCustomerCaseDto } from "./dto/create-customer-case.dto";
import { CreateCustomerCaseUpdateDto } from "./dto/create-customer-case-update.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";
import { ChangeCustomerPasswordDto } from "./dto/change-customer-password.dto";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface CustomerRequestSummary {
  id: string;
  type: "inquiry" | "import" | "clearing" | "hire" | "contact";
  summary: string;
  status: string;
  createdAt: Date;
  // Hire requests are real bookings with dates/pricing worth showing
  // precisely rather than collapsing into the generic summary string.
  hireDetails?: {
    vehicleName: string;
    pickupDate: Date;
    returnDate: Date;
    days: number;
    totalCost: number;
    currency: string;
  };
}

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  createdAt: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

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

  /**
   * Always resolves the same way regardless of whether the email matches an
   * account — same reasoning as login's identical error for "no such user"
   * vs. "wrong password": don't let this endpoint be used to enumerate
   * which emails have accounts.
   */
  async requestPasswordReset(email: string): Promise<{ requested: true }> {
    const customer = await this.prisma.customerUser.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (customer && customer.isActive) {
      const rawToken = randomBytes(32).toString("hex");
      await this.prisma.passwordResetToken.create({
        data: {
          customerId: customer.id,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });

      const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
      const resetUrl = `${frontendUrl}/account/reset-password?token=${rawToken}`;
      const template = passwordResetEmail(resetUrl);
      await this.emailService.send({ to: customer.email, ...template });
    }

    return { requested: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ reset: true }> {
    const tokenHash = hashToken(rawToken);
    const resetToken = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException("This password reset link is invalid or has expired.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.customerUser.update({
        where: { id: resetToken.customerId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { reset: true };
  }

  async updateProfile(customerId: string, dto: UpdateCustomerProfileDto) {
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.customerUser.findUnique({ where: { email } });
      if (existing && existing.id !== customerId) {
        throw new ConflictException("A customer with this email already exists.");
      }
    }

    return this.prisma.customerUser.update({
      where: { id: customerId },
      data: {
        name: dto.name?.trim(),
        email: dto.email?.trim().toLowerCase(),
      },
      select: CUSTOMER_SELECT,
    });
  }

  async changePassword(customerId: string, dto: ChangeCustomerPasswordDto) {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException("Customer not found.");
    }

    const currentMatches = await bcrypt.compare(dto.currentPassword, customer.passwordHash);
    if (!currentMatches) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.customerUser.update({ where: { id: customerId }, data: { passwordHash } });
    return { updated: true };
  }

  async findMyRequests(customerId: string): Promise<CustomerRequestSummary[]> {
    const [inquiries, importRequests, clearingRequests, hireRequests, contactMessages] = await Promise.all([
      this.prisma.inquiry.findMany({
        where: { customerId },
        include: { vehicle: { select: { make: true, model: true, year: true } } },
      }),
      this.prisma.importRequest.findMany({ where: { customerId } }),
      this.prisma.clearingRequest.findMany({ where: { customerId } }),
      this.prisma.hireRequest.findMany({ where: { customerId }, include: { vehicle: true } }),
      this.prisma.contactMessage.findMany({ where: { customerId } }),
    ]);

    const summaries: CustomerRequestSummary[] = [
      ...inquiries.map((r) => ({
        id: r.id,
        type: "inquiry" as const,
        summary: r.vehicle ? `${r.vehicle.make} ${r.vehicle.model} (${r.vehicle.year})` : "General inquiry",
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...importRequests.map((r) => ({
        id: r.id,
        type: "import" as const,
        summary: `${r.preferredMake} ${r.preferredModel ?? ""}`.trim(),
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...clearingRequests.map((r) => ({
        id: r.id,
        type: "clearing" as const,
        summary: `${r.vehicleMake} ${r.vehicleModel ?? ""} (VIN ${r.vin})`.trim(),
        status: r.status,
        createdAt: r.createdAt,
      })),
      ...hireRequests.map((r) => ({
        id: r.id,
        type: "hire" as const,
        summary: r.vehicle.name,
        status: r.status,
        createdAt: r.createdAt,
        hireDetails: {
          vehicleName: r.vehicle.name,
          pickupDate: r.pickupDate,
          returnDate: r.returnDate,
          days: r.days,
          totalCost: r.totalCost,
          currency: r.currency,
        },
      })),
      ...contactMessages.map((r) => ({
        id: r.id,
        type: "contact" as const,
        summary: r.subject,
        status: r.status,
        createdAt: r.createdAt,
      })),
    ];

    return summaries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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