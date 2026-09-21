import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MetaClient } from "./meta.client";
import { SocialController } from "./social.controller";
import { SocialCron } from "./social.cron";
import { SocialService } from "./social.service";

@Module({
  imports: [AuthModule],
  controllers: [SocialController],
  providers: [SocialService, SocialCron, MetaClient],
})
export class SocialModule {}
