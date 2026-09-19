import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LycieController } from "./lycie.controller";
import { LycieService } from "./lycie.service";
import { ContextService } from "./context.service";
import { GeminiClient } from "./gemini.client";
import { LycieLogsCron } from "./lycie-logs.cron";

@Module({
  imports: [AuthModule],
  controllers: [LycieController],
  providers: [LycieService, ContextService, GeminiClient, LycieLogsCron],
})
export class LycieModule {}
