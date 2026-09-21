import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DealsService } from "./deals.service";

/**
 * Every Monday at 7am the deals desk searches the web once, so fresh deals are waiting for review at
 * the start of the week. Deals are only saved as NEW — a person still decides what to publish.
 * Turn off with DEALS_AUTO_SCAN=false. Needs GEMINI_API_KEY.
 */
@Injectable()
export class DealsCron {
  private readonly logger = new Logger(DealsCron.name);

  constructor(private readonly deals: DealsService) {}

  @Cron("0 7 * * 1")
  async weeklyScan(): Promise<void> {
    if (process.env.DEALS_AUTO_SCAN === "false" || !this.deals.aiAvailable) return;
    try {
      const result = await this.deals.scan();
      this.logger.log(`Weekly deal search: ${result.added} new deal(s) waiting for review.`);
    } catch (error) {
      this.logger.warn(`Weekly deal search failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
