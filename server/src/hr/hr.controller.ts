import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";
import { HrService } from "./hr.service";
import { CreateLeaveDto, ReviewLeaveDto } from "./hr.dto";

/** People (HR). /hr/directory and /hr/leave/me are for every staff member; the rest needs HR access (route-access.ts). */
@Controller("hr")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get("directory")
  directory() {
    return this.hr.directory();
  }

  @Get("leave/me")
  myLeave(@CurrentStaff() actor: StaffActor) {
    return this.hr.myLeave(actor.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("leave/me")
  requestLeave(@CurrentStaff() actor: StaffActor, @Body() dto: CreateLeaveDto) {
    return this.hr.requestLeave(actor, dto);
  }

  @Post("leave/me/:id/cancel")
  cancel(@CurrentStaff() actor: StaffActor, @Param("id") id: string) {
    return this.hr.cancelMine(actor, id);
  }

  @Get("leave")
  list(@Query("status") status?: string) {
    return this.hr.list(status && ["pending", "approved", "declined", "cancelled"].includes(status) ? status : undefined);
  }

  @Patch("leave/:id")
  review(@CurrentStaff() actor: StaffActor, @Param("id") id: string, @Body() dto: ReviewLeaveDto) {
    return this.hr.review(actor, id, dto);
  }

  @Get("summary")
  summary() {
    return this.hr.summary();
  }
}
