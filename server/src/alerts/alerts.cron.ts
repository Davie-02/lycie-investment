import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AlertsService } from "./alerts.service";

/** Every 10 minutes: email new matching vehicles to alerts, and price drops on saved vehicles. */
@Injectable()
export class AlertsCron {
  private readonly logger = new Logger(AlertsCron.name);

  constructor(private readonly alerts: AlertsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    try {
      await this.alerts.runOnce();
    } catch (error) {
      this.logger.warn(`Vehicle alerts run failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
