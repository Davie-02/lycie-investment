import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { AlertsService } from "./alerts.service";
import { CreateVehicleAlertDto, UpdateVehicleAlertDto } from "./dto/alert.dto";

/** A signed-in customer's own vehicle alerts. */
@Controller("customers/me/alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class CustomerAlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentUser() user: { sub: string }) {
    return this.alerts.list(user.sub);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateVehicleAlertDto) {
    return this.alerts.create(user.sub, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: { sub: string }, @Param("id") id: string, @Body() dto: UpdateVehicleAlertDto) {
    return this.alerts.setActive(user.sub, id, dto.isActive);
  }

  @Delete(":id")
  remove(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    return this.alerts.remove(user.sub, id);
  }
}

/** Admin view: what customers are waiting for. */
@Controller("alerts")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "MANAGER")
export class AlertsAdminController {
  constructor(private readonly alerts: AlertsService) {}

  @Get("demand")
  demand() {
    return this.alerts.demand();
  }
}
