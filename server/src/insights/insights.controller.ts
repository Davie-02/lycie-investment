import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InsightsService } from "./insights.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("insights")
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  // Public and anonymous by design (called from the vehicle page itself).
  // Throttled so it can't be used to inflate a vehicle's numbers cheaply.
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post("vehicle-views/:vehicleId")
  recordView(@Param("vehicleId") vehicleId: string) {
    return this.insights.recordVehicleView(vehicleId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("overview")
  overview() {
    return this.insights.getOverview();
  }
}
