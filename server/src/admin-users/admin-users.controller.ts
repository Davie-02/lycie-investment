/**
 * Staff accounts API. Open to staff routes in general; RolesGuard lets in
 * those with HR or System access (access/route-access.ts), and the service
 * applies the finer rules (only system administrators touch administrators,
 * roles and module access; sensitive changes need a recent "confirm it's you").
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminUsersService } from "./admin-users.service";
import { CreateAdminUserDto } from "./dto/create-admin-user.dto";
import { UpdateAdminUserDto } from "./dto/update-admin-user.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";
import { DEPARTMENTS, MODULES } from "../access/modules";

@Controller("admin-users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  findAll() {
    return this.adminUsersService.findAll();
  }

  /** The departments and modules the access editor offers. */
  @Get("catalog")
  catalog() {
    return {
      modules: MODULES,
      departments: Object.entries(DEPARTMENTS).map(([key, value]) => ({ key, label: value.label, access: value.access })),
    };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateAdminUserDto, @CurrentStaff() actor: StaffActor) {
    return this.adminUsersService.create(dto, actor);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAdminUserDto, @CurrentStaff() actor: StaffActor) {
    return this.adminUsersService.update(id, dto, actor);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentStaff() actor: StaffActor) {
    return this.adminUsersService.remove(id, actor);
  }
}
