import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ResearchModule } from "../research/research.module";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";

@Module({
  imports: [AuthModule, ResearchModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
