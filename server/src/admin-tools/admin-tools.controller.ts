import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional } from "class-validator";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AdminToolsService } from "./admin-tools.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { UndoService, type Actor } from "../undo/undo.service";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";

class UndoDto {
  /** Undo even though some of the rows were changed again afterwards. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

@Controller("admin-tools")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminToolsController {
  constructor(
    private readonly tools: AdminToolsService,
    private readonly undo: UndoService
  ) {}

  @Roles(...ADMIN_ROLES)
  @Get("overview")
  overview(@CurrentStaff() actor: StaffActor) {
    return this.tools.overview(actor.access);
  }

  @Roles(...ADMIN_ROLES)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("search")
  search(@CurrentStaff() actor: StaffActor, @Query("q") q = "") {
    return this.tools.search(q.slice(0, 80), actor.access);
  }

  // Personal data leaves the system here, so: Owner/Manager only, rate-limited, logged like any other admin action by the audit trail of requests.
  @Roles("OWNER", "MANAGER")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @Get("export/:type")
  async export(@Param("type") type: string, @Res() response: Response) {
    const { filename, csv } = await this.tools.exportCsv(this.tools.ensureType(type));
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send("﻿" + csv); // BOM so Excel reads UTF-8 names correctly
  }

  /** Security rules in force and which outside services are connected (System module). */
  @Roles(...ADMIN_ROLES)
  @Get("system-status")
  systemStatus() {
    return this.tools.systemStatus();
  }

  /** The activity log. Owners see everyone's actions (or `mine=1` for their own); Managers see their own. */
  @Roles(...ADMIN_ROLES)
  @Get("activity")
  activity(@CurrentUser() user: Actor, @Query("page") page = "1", @Query("mine") mine = "") {
    const parsed = Math.max(1, Math.floor(Number(page)) || 1);
    return this.undo.list(user, parsed, 50, mine === "1");
  }

  /** Reverses one logged action (see server/src/undo/). The reversal is logged too, so it can be redone. */
  @Roles(...ADMIN_ROLES)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post("activity/:id/undo")
  undoAction(@CurrentUser() user: Actor, @Param("id") id: string, @Body() dto: UndoDto) {
    return this.undo.undo(id, user, dto.force === true);
  }
}
