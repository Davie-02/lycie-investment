import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { hireDueSoonReminderEmail, hireOverdueReminderEmail } from "../email/email-templates";

@Injectable()
export class HireRemindersCron {
  private readonly logger = new Logger(HireRemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  // Runs once a day. Only ever emails a given booking once for "due
  // tomorrow" and once for "overdue" — see dueReminderSentAt /
  // overdueReminderSentAt on the HireRequest model.
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendReminders(): Promise<void> {
    await this.sendDueSoonReminders();
    await this.sendOverdueReminders();
  }

  private async sendDueSoonReminders(): Promise<void> {
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const dueSoon = await this.prisma.hireRequest.findMany({
      where: {
        status: "confirmed",
        dueReminderSentAt: null,
        returnDate: { gte: tomorrowStart, lte: tomorrowEnd },
      },
      include: { vehicle: true },
    });

    for (const request of dueSoon) {
      const template = hireDueSoonReminderEmail({
        fullName: request.fullName,
        vehicleName: request.vehicle.name,
        pickupDate: request.pickupDate,
        returnDate: request.returnDate,
        days: request.days,
        totalCost: request.totalCost,
        currency: request.currency,
      });
      await this.emailService.send({ to: request.email, ...template });
      await this.prisma.hireRequest.update({
        where: { id: request.id },
        data: { dueReminderSentAt: new Date() },
      });
    }

    if (dueSoon.length > 0) {
      this.logger.log(`Sent ${dueSoon.length} "due tomorrow" reminder(s).`);
    }
  }

  private async sendOverdueReminders(): Promise<void> {
    const now = new Date();

    const overdue = await this.prisma.hireRequest.findMany({
      where: {
        status: "confirmed",
        overdueReminderSentAt: null,
        returnDate: { lt: now },
      },
      include: { vehicle: true },
    });

    for (const request of overdue) {
      const template = hireOverdueReminderEmail({
        fullName: request.fullName,
        vehicleName: request.vehicle.name,
        pickupDate: request.pickupDate,
        returnDate: request.returnDate,
        days: request.days,
        totalCost: request.totalCost,
        currency: request.currency,
      });
      await this.emailService.send({ to: request.email, ...template });
      await this.prisma.hireRequest.update({
        where: { id: request.id },
        data: { overdueReminderSentAt: new Date() },
      });
    }

    if (overdue.length > 0) {
      this.logger.log(`Sent ${overdue.length} overdue reminder(s).`);
    }
  }
}
