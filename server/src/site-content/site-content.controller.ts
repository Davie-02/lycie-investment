import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { SiteContentService } from "./site-content.service";
import { UpdateSiteContentDto } from "./dto/update-site-content.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("site-content")
export class SiteContentController {
  constructor(private readonly siteContentService: SiteContentService) {}

  @Get()
  findAll() {
    return this.siteContentService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":key")
  upsert(@Param("key") key: string, @Body() dto: UpdateSiteContentDto) {
    return this.siteContentService.upsert(key, dto);
  }
}
