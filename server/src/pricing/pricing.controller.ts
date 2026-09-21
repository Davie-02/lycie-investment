import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PricingService } from "./pricing.service";
import { UpdatePricingSettingsDto } from "./dto/update-pricing-settings.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

/**
 * Currency: prices are stored and shown in US dollars, with the kwacha equivalent
 * worked out from an exchange rate. The public endpoint only says what rate to use;
 * everything else is for Owners/Managers.
 */
@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Public: the rate the site uses to show "≈ MWK …". No secrets in here. */
  @Get()
  rate() {
    return this.pricing.getEffectiveRate();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  overview() {
    return this.pricing.getAdminOverview();
  }

  @Patch("settings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  updateSettings(@Body() dto: UpdatePricingSettingsDto) {
    return this.pricing.updateSettings(dto);
  }

  /** Re-fetches the live rate right now. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("refresh")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  async refresh() {
    await this.pricing.refresh();
    return this.pricing.getAdminOverview();
  }

  /** Owner-only, one-time: turn old kwacha listings into dollar listings. */
  @Post("convert-listings")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER")
  convert() {
    return this.pricing.convertListingsToUsd();
  }
}
