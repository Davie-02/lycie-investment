/**
 * Vehicle alerts ("email me when a matching vehicle is listed") and price-drop
 * emails for saved vehicles.
 *
 * Customers manage their alerts from their account page. A confirmed email is
 * required, so alerts can only ever go to an inbox the customer has proven is
 * theirs. `runOnce()` (every 10 minutes, see alerts.cron.ts) sends:
 *  - each new or newly published vehicle to every alert it matches, once;
 *  - a price-drop email when a saved vehicle's price goes down.
 * Owners/Managers can see what customers are waiting for (demand()), a strong
 * signal for what to import next.
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { PUBLIC } from "../content-admin/content-state";
import { priceDropEmail, vehicleAlertEmail } from "../email/email-templates";
import { priceText } from "../pricing/price-format";
import { describeAlert, vehicleMatchesAlert } from "./alert-match";
import { CreateVehicleAlertDto } from "./dto/alert.dto";

const MAX_ALERTS_PER_CUSTOMER = 10;
/** At most this many vehicles in one alert email; the rest wait for the next run. */
const MAX_VEHICLES_PER_EMAIL = 6;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService
  ) {}

  private frontendUrl(): string {
    return process.env.FRONTEND_URL ?? "http://localhost:5173";
  }

  async list(customerId: string) {
    const alerts = await this.prisma.vehicleAlert.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
    return alerts.map(({ sentVehicleIds, ...alert }) => ({ ...alert, label: describeAlert(alert), sentCount: sentVehicleIds.length }));
  }

  async create(customerId: string, dto: CreateVehicleAlertDto) {
    if (!dto.make && !dto.model && !dto.bodyType && !dto.maxPrice && !dto.minYear) {
      throw new BadRequestException("Tell us at least one thing you're looking for (a make, model, type, price or year).");
    }
    const customer = await this.prisma.customerUser.findUnique({ where: { id: customerId }, select: { emailVerifiedAt: true } });
    if (!customer?.emailVerifiedAt) {
      throw new ForbiddenException("Please confirm your email address first (see the banner on your account page), so alerts reach you.");
    }
    if ((await this.prisma.vehicleAlert.count({ where: { customerId } })) >= MAX_ALERTS_PER_CUSTOMER) {
      throw new BadRequestException(`You can have up to ${MAX_ALERTS_PER_CUSTOMER} alerts. Remove one to add another.`);
    }
    const alert = await this.prisma.vehicleAlert.create({
      data: { customerId, make: dto.make, model: dto.model, bodyType: dto.bodyType, maxPrice: dto.maxPrice, minYear: dto.minYear },
    });
    return { ...alert, label: describeAlert(alert), sentCount: 0 };
  }

  async setActive(customerId: string, id: string, isActive: boolean) {
    const result = await this.prisma.vehicleAlert.updateMany({ where: { id, customerId }, data: { isActive } });
    if (result.count === 0) throw new NotFoundException("Alert not found.");
    return { updated: true };
  }

  async remove(customerId: string, id: string) {
    const result = await this.prisma.vehicleAlert.deleteMany({ where: { id, customerId } });
    if (result.count === 0) throw new NotFoundException("Alert not found.");
    return { deleted: true };
  }

  /** What customers are waiting for, most-wanted first (admin insight: what to import next). */
  async demand() {
    const alerts = await this.prisma.vehicleAlert.findMany({
      where: { isActive: true },
      select: { make: true, model: true, bodyType: true, maxPrice: true, minYear: true },
    });
    const counts = new Map<string, { label: string; count: number; budgets: number[] }>();
    for (const alert of alerts) {
      const label = describeAlert({ make: alert.make, model: alert.model, bodyType: alert.bodyType });
      const entry = counts.get(label.toLowerCase()) ?? { label, count: 0, budgets: [] };
      entry.count += 1;
      if (alert.maxPrice) entry.budgets.push(alert.maxPrice);
      counts.set(label.toLowerCase(), entry);
    }
    return {
      totalActive: alerts.length,
      wanted: [...counts.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
        .map(({ label, count, budgets }) => ({
          label,
          count,
          typicalBudget: budgets.length ? budgets.sort((a, b) => a - b)[Math.floor(budgets.length / 2)] : null,
        })),
    };
  }

  /** One pass of the background job. Safe to call often; overlapping calls are skipped. */
  async runOnce(): Promise<{ alertEmails: number; priceDropEmails: number }> {
    if (this.running) return { alertEmails: 0, priceDropEmails: 0 };
    this.running = true;
    try {
      const alertEmails = await this.sendMatches();
      const priceDropEmails = await this.sendPriceDrops();
      return { alertEmails, priceDropEmails };
    } finally {
      this.running = false;
    }
  }

  private async sendMatches(): Promise<number> {
    const alerts = await this.prisma.vehicleAlert.findMany({
      where: { isActive: true, customer: { isActive: true, emailVerifiedAt: { not: null } } },
      include: { customer: { select: { name: true, email: true } } },
    });
    if (alerts.length === 0) return 0;

    const oldest = alerts.reduce((min, alert) => (alert.createdAt < min ? alert.createdAt : min), alerts[0].createdAt);
    // Vehicles listed (or last edited, e.g. published from draft) since the oldest alert was made.
    const vehicles = await this.prisma.vehicle.findMany({
      where: { ...PUBLIC.vehicles, status: "available", updatedAt: { gte: oldest } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    let sent = 0;
    for (const alert of alerts) {
      const fresh = vehicles.filter(
        (vehicle) => vehicle.updatedAt >= alert.createdAt && !alert.sentVehicleIds.includes(vehicle.id) && vehicleMatchesAlert(vehicle, alert)
      );
      if (fresh.length === 0) continue;
      const batch = fresh.slice(0, MAX_VEHICLES_PER_EMAIL);

      // Mark as sent BEFORE emailing, so a crash can never cause the same email twice.
      await this.prisma.vehicleAlert.update({
        where: { id: alert.id },
        data: { sentVehicleIds: [...alert.sentVehicleIds, ...batch.map((v) => v.id)].slice(-500), lastSentAt: new Date() },
      });
      const result = await this.email.sendChecked({
        to: alert.customer.email,
        ...vehicleAlertEmail({
          name: alert.customer.name,
          alertLabel: describeAlert(alert),
          vehicles: batch.map((v) => ({
            label: `${v.year} ${v.make} ${v.model}`,
            price: priceText(v.price, v.currency, null),
            url: `${this.frontendUrl()}/vehicles/${encodeURIComponent(v.slug)}`,
          })),
          manageUrl: `${this.frontendUrl()}/account/saved`,
        }),
      });
      if (result.ok) sent += 1;
    }
    if (sent) this.logger.log(`Sent ${sent} vehicle alert email(s).`);
    return sent;
  }

  private async sendPriceDrops(): Promise<number> {
    const saved = await this.prisma.savedVehicle.findMany({
      where: { vehicle: { ...PUBLIC.vehicles, status: "available" }, customer: { isActive: true } },
      include: {
        vehicle: { select: { id: true, slug: true, make: true, model: true, year: true, price: true, currency: true } },
        customer: { select: { name: true, email: true, emailVerifiedAt: true } },
      },
      take: 2000,
    });

    let sent = 0;
    for (const row of saved) {
      const price = row.vehicle.price;
      if (row.notifiedPrice === null || price > row.notifiedPrice) {
        // First sighting, or the price went up: remember it quietly so the next drop is measured from here.
        await this.prisma.savedVehicle.update({ where: { id: row.id }, data: { notifiedPrice: price } });
        continue;
      }
      if (price >= row.notifiedPrice) continue;

      await this.prisma.savedVehicle.update({ where: { id: row.id }, data: { notifiedPrice: price } });
      if (!row.customer.emailVerifiedAt) continue;
      const v = row.vehicle;
      const result = await this.email.sendChecked({
        to: row.customer.email,
        ...priceDropEmail({
          name: row.customer.name,
          vehicle: {
            label: `${v.year} ${v.make} ${v.model}`,
            price: priceText(price, v.currency, null),
            url: `${this.frontendUrl()}/vehicles/${encodeURIComponent(v.slug)}`,
          },
          oldPrice: priceText(row.notifiedPrice, v.currency, null),
          manageUrl: `${this.frontendUrl()}/account/saved`,
        }),
      });
      if (result.ok) sent += 1;
    }
    if (sent) this.logger.log(`Sent ${sent} price-drop email(s).`);
    return sent;
  }
}
