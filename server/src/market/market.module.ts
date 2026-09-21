import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GeminiModule } from "../lycie/gemini.module";
import { MarketController } from "./market.controller";
import { MarketService } from "./market.service";

@Module({
  imports: [AuthModule, GeminiModule],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
