import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ResearchModule } from "../research/research.module";
import { DealsAdminController, DealsController } from "./deals.controller";
import { DealsCron } from "./deals.cron";
import { DealsService } from "./deals.service";

@Module({
  imports: [AuthModule, ResearchModule],
  controllers: [DealsController, DealsAdminController],
  providers: [DealsService, DealsCron],
  exports: [DealsService],
})
export class DealsModule {}
