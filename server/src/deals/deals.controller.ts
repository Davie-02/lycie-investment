import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { DealStatus } from "@prisma/client";
import { DealsService } from "./deals.service";
import { CreateDealDto, UpdateDealDto } from "./dto/deal.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

/** PUBLIC: the deals visitors may see. Never includes how-to-get notes or where a deal was found. */
@Controller("deals")
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list() {
    return this.deals.listPublic();
  }
}

/** ADMIN ONLY (Owner/Manager): find, review, edit, publish and dismiss deals. Sources and how-to-get notes live here. */
@Controller("deal-admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER", "MANAGER")
export class DealsAdminController {
  constructor(private readonly deals: DealsService) {}

  @Get()
  list(@Query("status") status?: string) {
    const valid = status && (Object.values(DealStatus) as string[]).includes(status) ? (status as DealStatus) : undefined;
    return this.deals.listAdmin(valid);
  }

  /** Searches the internet for current deals (uses the AI quota, so it is rate limited). */
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  @Post("scan")
  @HttpCode(200)
  scan() {
    return this.deals.scan();
  }

  @Post()
  create(@Body() dto: CreateDealDto) {
    return this.deals.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateDealDto) {
    return this.deals.update(id, dto);
  }

  @Post(":id/publish")
  @HttpCode(200)
  publish(@Param("id") id: string) {
    return this.deals.setStatus(id, "publish");
  }

  @Post(":id/unpublish")
  @HttpCode(200)
  unpublish(@Param("id") id: string) {
    return this.deals.setStatus(id, "unpublish");
  }

  @Post(":id/dismiss")
  @HttpCode(200)
  dismiss(@Param("id") id: string) {
    return this.deals.setStatus(id, "dismiss");
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.deals.remove(id);
  }
}
