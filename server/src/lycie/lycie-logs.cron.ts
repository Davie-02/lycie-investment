import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { LycieService } from "./lycie.service";

@Injectable()
export class LycieLogsCron {
  private readonly logger = new Logger(LycieLogsCron.name);

  constructor(private readonly lycie: LycieService) {}

  // Chat logs are kept only as long as they're useful for spotting gaps
  // (LYCIE_LOG_RETENTION_DAYS, default 90).
  @Cron("0 3 * * *")
  async purge(): Promise<void> {
    const removed = await this.lycie.purgeOldLogs();
    if (removed > 0) this.logger.log(`Purged ${removed} chat log(s) past retention.`);
  }
}
