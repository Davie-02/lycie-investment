import { Controller, Get, Header, Param, Query, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AdminToolsService } from "./admin-tools.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("admin-tools")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminToolsController {
  constructor(private readonly tools: AdminToolsService) {}

  @Roles("OWNER", "MANAGER")
  @Get("overview")
  overview() {
    return this.tools.overview();
  }

  @Roles("OWNER", "MANAGER")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("search")
  search(@Query("q") q = "") {
    return this.tools.search(q.slice(0, 80));
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

  @Roles("OWNER")
  @Get("activity")
  activity(@Query("page") page = "1") {
    const parsed = Math.max(1, Math.floor(Number(page)) || 1);
    return this.tools.activity(parsed, 50);
  }
}
