import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { AdminToolsService } from "./admin-tools.service";

@Injectable()
export class AdminToolsCron {
  private readonly logger = new Logger(AdminToolsCron.name);
  constructor(private readonly tools: AdminToolsService) {}

  // Keep the activity log to the last six months.
  @Cron("30 3 * * *")
  async purge(): Promise<void> {
    const removed = await this.tools.purgeOldActivity();
    if (removed > 0) this.logger.log(`Purged ${removed} old activity record(s).`);
  }
}
