import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
import { UpdateHireRequestStatusDto } from "./dto/update-hire-request-status.dto";
import { calculateHireCost } from "./hire-pricing.util";

@Injectable()
export class HireRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.hireRequest.create({
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
   * Only "confirmed" bookings represent a real commitment on a vehicle —
   * this is what the admin Bookings view shows, filtered to confirmed
   * requests whose return date hasn't passed yet (still upcoming or active).
   */
  findBookings() {
    return this.prisma.hireRequest.findMany({
      where: { status: "confirmed", returnDate: { gte: new Date() } },
      orderBy: { pickupDate: "asc" },
      include: { vehicle: true },
    });
  }

  async updateStatus(id: string, dto: UpdateHireRequestStatusDto) {
    const request = await this.prisma.hireRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException("Hire request not found.");
    }

    if (dto.status === "confirmed") {
      const overlapping = await this.prisma.hireRequest.findFirst({
        where: {
          id: { not: id },
          vehicleId: request.vehicleId,
          status: "confirmed",
          // Two date ranges overlap when each starts before the other ends.
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

    return this.prisma.hireRequest.update({
      where: { id },
      data: { status: dto.status },
      include: { vehicle: true },
    });
  }
}
