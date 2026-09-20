import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
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

  // Owner only: replaces About/Services/Contact/Team/… text with the company profile.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER")
  @HttpCode(200)
  @Post("apply-profile")
  applyProfile() {
    return this.siteContentService.applyCompanyProfile();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":key")
  upsert(@Param("key") key: string, @Body() dto: UpdateSiteContentDto) {
    return this.siteContentService.upsert(key, dto);
  }
}
