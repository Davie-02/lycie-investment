import { Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { MarketService } from "./market.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

/** Admin only (Owner/Manager): what customers want, and how to do better than other companies. */
@Controller("market")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "MANAGER")
export class MarketController {
  constructor(private readonly market: MarketService) {}

  /** Ranked demand from the company's own numbers. */
  @Get("demand")
  demand() {
    return this.market.demand();
  }

  /** The latest AI briefing (or null) and whether AI research is available. */
  @Get("report")
  async report() {
    return { report: await this.market.latestReport(), aiAvailable: this.market.aiAvailable };
  }

  /** Researches the market on the web and writes a new briefing (uses the AI quota). */
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @Post("report")
  @HttpCode(200)
  generate() {
    return this.market.generateReport();
  }
}
