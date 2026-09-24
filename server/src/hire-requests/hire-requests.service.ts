import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { CreateHireRequestDto } from "./dto/create-hire-request.dto";
import { UpdateHireRequestStatusDto } from "./dto/update-hire-request-status.dto";
import { calculateHireCost } from "./hire-pricing.util";
import { runSerializable } from "../common/run-serializable";
import { NotificationsService } from "../notifications/notifications.service";
import {
  hireRequestReceivedEmail,
  hireBookingConfirmedEmail,
  hireBookingCancelledEmail,
  hireBookingCompletedEmail,
  adminNewSubmissionEmail,
} from "../email/email-templates";

/** Longest single hire that can be requested online. */
const MAX_HIRE_DAYS = 365;

@Injectable()
export class HireRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService
  ) {}

  async create(dto: CreateHireRequestDto, customerId?: string) {
    const vehicle = await this.prisma.hireVehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException("The selected hire vehicle could not be found.");
    }

    if (!vehicle.available || !vehicle.isPublished || vehicle.archivedAt) {
      throw new BadRequestException("This vehicle isn't available for hire right now. Please choose another one.");
    }

    const pickupDate = new Date(dto.pickupDate);
    const returnDate = new Date(dto.returnDate);
    if (returnDate < pickupDate) {
      throw new BadRequestException("Return date cannot be before pickup date.");
    }
    // A day of slack for time zones: "today" in Malawi may still be "yesterday" on the server.
    if (pickupDate.getTime() < Date.now() - 36 * 60 * 60_000) {
      throw new BadRequestException("The pickup date is in the past. Please choose a date from today onwards.");
    }
    if (returnDate.getTime() - pickupDate.getTime() > MAX_HIRE_DAYS * 24 * 60 * 60_000) {
      throw new BadRequestException(`Hires can be booked for up to ${MAX_HIRE_DAYS} days at a time. For longer, please contact us.`);
    }

    // Tell the customer now, rather than after an admin has to turn them down.
    const clash = await this.prisma.hireRequest.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: "confirmed",
        pickupDate: { lt: returnDate },
        returnDate: { gt: pickupDate },
      },
      select: { pickupDate: true, returnDate: true },
    });
    if (clash) {
      const day = (date: Date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      throw new ConflictException(
        `${vehicle.name} is already booked from ${day(clash.pickupDate)} to ${day(clash.returnDate)}. Please choose other dates or another vehicle.`
      );
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
        preferredContact: dto.preferredContact,
        pickupDate,
        returnDate,
        pickupLocation: dto.pickupLocation,
        additionalRequirements: dto.additionalRequirements,
        days,
        totalCost,
        currency: vehicle.currency,
        customerId,
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

  /**
   * Public: the date ranges a hire vehicle is already booked for (confirmed
   * bookings from today on), so the booking form can show them and customers
   * pick free dates. Only dates — never who booked.
   */
  async availability(vehicleId: string): Promise<{ booked: Array<{ from: string; to: string }> }> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const bookings = await this.prisma.hireRequest.findMany({
      where: { vehicleId, status: "confirmed", returnDate: { gte: startOfToday } },
      orderBy: { pickupDate: "asc" },
      select: { pickupDate: true, returnDate: true },
      take: 200,
    });
    return { booked: bookings.map((b) => ({ from: b.pickupDate.toISOString(), to: b.returnDate.toISOString() })) };
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
    // The overlap check and the actual status write happen inside one
    // Serializable transaction — otherwise two admins confirming two
    // overlapping requests for the same vehicle at nearly the same moment
    // could both pass the "no overlap" check before either one writes,
    // and both would end up confirmed. See run-serializable.ts.
    const updated = await runSerializable(this.prisma, async (tx) => {
      const request = await tx.hireRequest.findUnique({ where: { id }, include: { vehicle: true } });
      if (!request) {
        throw new NotFoundException("Hire request not found.");
      }

      if (dto.status === "confirmed") {
        const overlapping = await tx.hireRequest.findFirst({
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

      return tx.hireRequest.update({
        where: { id },
        data: { status: dto.status },
        include: { vehicle: true },
      });
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
    // WhatsApp too, for customers who gave a phone number (email already went above).
    const whatsappText: Record<string, string> = {
      confirmed: `Your booking of the ${updated.vehicle.name} (${updated.pickupDate.toDateString()} to ${updated.returnDate.toDateString()}) is confirmed.`,
      cancelled: `Your booking of the ${updated.vehicle.name} has been cancelled. Contact us if you have questions.`,
      completed: `Thank you for hiring the ${updated.vehicle.name} with us.`,
    };
    if (whatsappText[dto.status]) {
      void this.notifications.notify({ phone: updated.phone, preferredContact: updated.preferredContact, subject: "", html: "", text: whatsappText[dto.status] });
    }
    // Reverting to "pending" doesn't send an email — that's an internal
    // admin correction, not something the customer needs to hear about.

    return updated;
  }

  async cancelByCustomer(id: string, customerId: string) {
    const request = await this.prisma.hireRequest.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (!request || request.customerId !== customerId) {
      throw new NotFoundException("Hire request not found.");
    }
    if (request.status !== "pending") {
      throw new ForbiddenException("Only a pending hire request can be cancelled.");
    }

    const updated = await this.prisma.hireRequest.update({
      where: { id },
      data: { status: "cancelled" },
      include: { vehicle: true },
    });

    await this.emailService.send({
      to: updated.email,
      ...hireBookingCancelledEmail({
        fullName: updated.fullName,
        vehicleName: updated.vehicle.name,
        pickupDate: updated.pickupDate,
        returnDate: updated.returnDate,
        days: updated.days,
        totalCost: updated.totalCost,
        currency: updated.currency,
      }),
    });

    return updated;
  }
}
