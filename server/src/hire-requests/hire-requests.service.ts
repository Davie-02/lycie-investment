import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
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

    // Computed here, server-side, from the vehicle's actual current rates —
    // never trust a price the client might send, since that's the exact
    // kind of field a tampered request would try to lower.
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
      include: { vehicle: { select: { name: true, slug: true } } },
    });
  }
}
