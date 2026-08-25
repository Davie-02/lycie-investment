import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
import { UpdateHireRequestStatusDto } from "./dto/update-hire-request-status.dto";
import { calculateHireCost } from "./hire-pricing.util";
import {
  hireRequestReceivedEmail,
  hireBookingConfirmedEmail,
  hireBookingCancelledEmail,
  hireBookingCompletedEmail,
  adminNewSubmissionEmail,
} from "../email/email-templates";

@Injectable()
export class HireRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateHireRequestDto) {
    const vehicle = await this.prisma.hireVehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException("The selected hire vehicle could not be found.");
    }

    const pickupDate = new Date(dto.pickupDate);
    const returnDate = new Date(dto.returnDate);
    if (returnDate < pickupDate) {
      throw new BadRequestException("Return date cannot be before pickup date.");
    }

    const { days, totalCost } = calculateHireCost(
      vehicle.dailyRate,
      vehicle.weeklyRate,
      pickupDate,
      returnDate
    );

    const request = await this.prisma.hireRequest.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        vehicleId: dto.vehicleId,
        pickupDate,
        returnDate,
        pickupLocation: dto.pickupLocation,
        additionalRequirements: dto.additionalRequirements,
        days,
        totalCost,
        currency: vehicle.currency,
      },
    });

    const emailDetails = {
      fullName: request.fullName,
      vehicleName: vehicle.name,
      pickupDate,
      returnDate,
      days,
      totalCost,
      currency: vehicle.currency,
    };

    await this.emailService.send({ to: request.email, ...hireRequestReceivedEmail(emailDetails) });

    const adminEmail = adminNewSubmissionEmail("hire request", [
      `${request.fullName} (${request.phone}, ${request.email})`,
      `Vehicle: ${vehicle.name}`,
      `${pickupDate.toLocaleDateString()} → ${returnDate.toLocaleDateString()} (${days} days)`,
      `Estimated total: ${vehicle.currency} ${totalCost.toLocaleString()}`,
    ]);
    await this.emailService.notifyAdmin(adminEmail.subject, adminEmail.html);

    return request;
  }

  findAll() {
    return this.prisma.hireRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: { vehicle: true },
    });
  }

  async findOne(id: string) {
    const request = await this.prisma.hireRequest.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!request) {
      throw new NotFoundException("Hire request not found.");
    }
    return request;
  }

  /**
   * Confirmed bookings that haven't been marked "completed" yet — this
   * intentionally includes ones whose return date has already passed
   * (overdue), since those are exactly the ones an admin most needs to see
   * until someone actually marks the vehicle returned.
   */
  findBookings() {
    return this.prisma.hireRequest.findMany({
      where: { status: "confirmed" },
      orderBy: { pickupDate: "asc" },
      include: { vehicle: true },
    });
  }

  async updateStatus(id: string, dto: UpdateHireRequestStatusDto) {
    const request = await this.prisma.hireRequest.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!request) {
      throw new NotFoundException("Hire request not found.");
    }

    if (dto.status === "confirmed") {
      const overlapping = await this.prisma.hireRequest.findFirst({
        where: {
          id: { not: id },
          vehicleId: request.vehicleId,
          status: "confirmed",
          pickupDate: { lt: request.returnDate },
          returnDate: { gt: request.pickupDate },
        },
      });
      if (overlapping) {
        throw new ConflictException(
          "This vehicle already has a confirmed booking that overlaps these dates."
        );
      }
    }

    const updated = await this.prisma.hireRequest.update({
      where: { id },
      data: { status: dto.status },
      include: { vehicle: true },
    });

    const emailDetails = {
      fullName: updated.fullName,
      vehicleName: updated.vehicle.name,
      pickupDate: updated.pickupDate,
      returnDate: updated.returnDate,
      days: updated.days,
      totalCost: updated.totalCost,
      currency: updated.currency,
    };

    if (dto.status === "confirmed") {
      await this.emailService.send({ to: updated.email, ...hireBookingConfirmedEmail(emailDetails) });
    } else if (dto.status === "cancelled") {
      await this.emailService.send({ to: updated.email, ...hireBookingCancelledEmail(emailDetails) });
    } else if (dto.status === "completed") {
      await this.emailService.send({ to: updated.email, ...hireBookingCompletedEmail(emailDetails) });
    }
    // Reverting to "pending" doesn't send an email — that's an internal
    // admin correction, not something the customer needs to hear about.

    return updated;
  }
}
