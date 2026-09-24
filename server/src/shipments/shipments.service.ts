/**
 * Shipment tracking for imports and clearing (Imports & Clearing module).
 *
 * Staff open a shipment for a customer (it gets a tracking code like
 * LYC-7K2M9Q), then post progress through the stages in stages.ts — with a
 * message and optional photos (e.g. at the port). Each update is emailed and,
 * when set up, sent by WhatsApp. Customers follow it on their account page or,
 * without signing in, at /track with the code (which shows no personal details).
 */
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "crypto";
import { CustomerCaseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { shipmentUpdateEmail } from "../email/email-templates";
import { CreateShipmentDto, ShipmentProgressDto, UpdateShipmentDto } from "./shipments.dto";
import { STAGES, stageInfo } from "./stages";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newTrackingCode(): string {
  let code = "LYC-";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return code;
}

/** Only our own uploaded images may be attached (no outside links shown to customers). */
function safePhotos(photos: string[] | undefined): string[] {
  return (photos ?? []).filter((url) => /^\/(api\/media|uploads)\/[\w.-]+$/.test(url) || /^https:\/\/[\w.-]+\/[\w./-]+\.webp$/.test(url));
}

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  list(q?: string) {
    const term = q?.trim();
    return this.prisma.customerCase.findMany({
      where: {
        kind: { in: ["import", "clearing"] },
        ...(term
          ? {
              OR: [
                { title: { contains: term, mode: "insensitive" } },
                { trackingCode: { contains: term, mode: "insensitive" } },
                { customer: { name: { contains: term, mode: "insensitive" } } },
                { customer: { email: { contains: term, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        updates: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  /** Finds customers to attach a shipment to (by name or email). */
  lookupCustomers(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    return this.prisma.customerUser.findMany({
      where: { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] },
      take: 8,
      select: { id: true, name: true, email: true },
    });
  }

  async create(dto: CreateShipmentDto) {
    const customer = await this.prisma.customerUser.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException("Customer not found.");
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.customerCase.create({
          data: {
            customerId: dto.customerId,
            title: dto.title,
            kind: dto.kind,
            details: dto.details,
            eta: dto.eta ? new Date(dto.eta) : null,
            vehicleId: dto.vehicleId || null,
            stage: "ordered",
            status: "REQUESTED",
            trackingCode: newTrackingCode(),
          },
        });
      } catch (error) {
        // Another shipment already has this random code — pick another.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    throw new BadRequestException("Couldn't create a tracking code. Please try again.");
  }

  async update(id: string, dto: UpdateShipmentDto) {
    await this.ensure(id);
    return this.prisma.customerCase.update({
      where: { id },
      data: {
        title: dto.title,
        details: dto.details,
        eta: dto.eta === undefined ? undefined : dto.eta ? new Date(dto.eta) : null,
      },
    });
  }

  async progress(id: string, dto: ShipmentProgressDto) {
    const shipment = await this.ensure(id);
    const stage = stageInfo(dto.stage)!;
    const status = stage.status as CustomerCaseStatus;
    const [update] = await this.prisma.$transaction([
      this.prisma.customerCaseUpdate.create({ data: { caseId: id, status, stage: stage.key, message: dto.message, photos: safePhotos(dto.photos) } }),
      this.prisma.customerCase.update({ where: { id }, data: { stage: stage.key, status } }),
    ]);

    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const trackUrl = `${frontendUrl}/track?code=${encodeURIComponent(shipment.trackingCode ?? "")}`;
    void this.notifications.notify({
      email: shipment.customer.email,
      phone: shipment.customer.phone,
      ...shipmentUpdateEmail({ name: shipment.customer.name, title: shipment.title, stageLabel: stage.label, message: dto.message, trackUrl }),
      text: `${shipment.title}: now "${stage.label}". ${dto.message} Track it: ${trackUrl}`,
    });
    return update;
  }

  /** Public tracking by code: progress only, never who the customer is. */
  async track(code: string) {
    const shipment = await this.prisma.customerCase.findUnique({
      where: { trackingCode: code.trim().toUpperCase() },
      include: { updates: { orderBy: { createdAt: "asc" } } },
    });
    if (!shipment) throw new NotFoundException("No shipment has that tracking code. Please check it and try again.");
    return {
      trackingCode: shipment.trackingCode,
      title: shipment.title,
      kind: shipment.kind,
      stage: shipment.stage,
      eta: shipment.eta,
      stages: STAGES.map(({ key, label }) => ({ key, label })),
      updates: shipment.updates.map((u) => ({ stage: u.stage, message: u.message, photos: u.photos, createdAt: u.createdAt })),
    };
  }

  async summary() {
    const [open, byStage, arrivingSoon] = await Promise.all([
      this.prisma.customerCase.count({ where: { kind: { in: ["import", "clearing"] }, status: { notIn: ["COMPLETED", "CANCELLED"] } } }),
      this.prisma.customerCase.groupBy({ by: ["stage"], where: { kind: { in: ["import", "clearing"] }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, _count: true }),
      this.prisma.customerCase.count({
        where: { kind: { in: ["import", "clearing"] }, status: { notIn: ["COMPLETED", "CANCELLED"] }, eta: { lte: new Date(Date.now() + 7 * 24 * 60 * 60_000) } },
      }),
    ]);
    return { open, arrivingSoon, byStage: byStage.map((row) => ({ stage: row.stage, count: row._count })) };
  }

  private async ensure(id: string) {
    const shipment = await this.prisma.customerCase.findUnique({ where: { id }, include: { customer: true } });
    if (!shipment) throw new NotFoundException("Shipment not found.");
    return shipment;
  }
}
