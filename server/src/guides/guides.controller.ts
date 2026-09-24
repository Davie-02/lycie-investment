import { Body, Controller, Delete, Get, Param, Put, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";
import { AUDIENCES, GuidesService } from "./guides.service";
import type { GuideAudience } from "./guide-defaults";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

class SaveGuideDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @IsIn(AUDIENCES)
  audience!: GuideAudience;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  departments!: string[];
}

/** The guides meant for the signed-in staff member (every staff member). */
@Controller("workspace/guides")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class MyGuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  mine(@CurrentStaff() actor: StaffActor) {
    return this.guides.visibleTo(actor);
  }
}

/**
 * Editing guides: the main system administrator only. This route is
 * deliberately not in access/route-access.ts, so no module access can open it —
 * only the OWNER role below.
 */
@Controller("guides")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("OWNER")
export class GuidesAdminController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  all() {
    return this.guides.all();
  }

  @Put(":key")
  save(@Param("key") key: string, @Body() dto: SaveGuideDto, @CurrentStaff() actor: StaffActor) {
    return this.guides.save(key, dto, actor);
  }

  @Delete(":key")
  reset(@Param("key") key: string) {
    return this.guides.reset(key);
  }
}
