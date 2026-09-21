import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SocialService } from "./social.service";

/** Every five minutes, sends any scheduled social posts whose time has arrived. */
@Injectable()
export class SocialCron {
  private readonly logger = new Logger(SocialCron.name);

  constructor(private readonly social: SocialService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDuePosts(): Promise<void> {
    try {
      const sent = await this.social.publishDue();
      if (sent > 0) this.logger.log(`Sent ${sent} scheduled social post(s).`);
    } catch (error) {
      this.logger.warn(`Scheduled posting check failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
