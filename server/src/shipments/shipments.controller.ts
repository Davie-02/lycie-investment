import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { ShipmentsService } from "./shipments.service";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";
import { CreateShipmentDto, ShipmentProgressDto, UpdateShipmentDto } from "./shipments.dto";

/**
 * Staff: Imports & Clearing. The full list needs the tracking privilege; others
 * look shipments up by code (see access/route-access.ts).
 */
@Controller("shipments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  list(@Query("q") q?: string) {
    return this.shipments.list(q?.slice(0, 80));
  }

  @Get("summary")
  summary() {
    return this.shipments.summary();
  }

  /** Find one shipment by the code the customer gives (limited, so codes can't be guessed by trying many). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get("lookup/:code")
  lookup(@Param("code") code: string) {
    return this.shipments.lookup(code.slice(0, 20));
  }

  @Post()
  create(@Body() dto: CreateShipmentDto, @CurrentStaff() actor: StaffActor) {
    return this.shipments.create(dto, actor);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateShipmentDto) {
    return this.shipments.update(id, dto);
  }

  @Post(":id/progress")
  progress(@Param("id") id: string, @Body() dto: ShipmentProgressDto) {
    return this.shipments.progress(id, dto);
  }
}

/** Staff: find a customer by name/email to attach work to. */
@Controller("customer-lookup")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class CustomerLookupController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  lookup(@Query("q") q = "") {
    return this.shipments.lookupCustomers(q.slice(0, 80));
  }
}
