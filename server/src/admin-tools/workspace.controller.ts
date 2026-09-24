import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";
import { WorkspaceService } from "./workspace.service";

/** Dashboard numbers for every module the signed-in staff member can see. */
@Controller("workspace")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get("summary")
  summary(@CurrentStaff() actor: StaffActor) {
    return this.workspace.summary(actor.access);
  }
}
