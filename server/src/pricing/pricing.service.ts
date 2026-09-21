import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { fetchLiveRate, type LiveRate } from "./rate-providers";
import { UpdatePricingSettingsDto } from "./dto/update-pricing-settings.dto";

/** How an admin has chosen to convert dollars to kwacha. Stored as one JSON row (SiteContent key "pricing"). */
export interface PricingSettings {
  mode: "auto" | "manual";
  manualRate: number | null;
  marginPercent: number;
  roundMwkTo: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = { mode: "auto", manualRate: null, marginPercent: 0, roundMwkTo: 1000 };

/** What the website needs to show "≈ MWK …" next to a dollar price. */
export interface EffectiveRate {
  /** Kwacha per 1 USD after margin, or null if no rate is known yet (site then shows USD only). */
  rate: number | null;
  source: "live" | "manual" | "last-known" | "none";
  /** When the underlying live rate was fetched (ISO), if any. */
  updatedAt: string | null;
  roundMwkTo: number;
}

const SETTINGS_KEY = "pricing";
const LAST_RATE_KEY = "pricing-rate";
/** A live rate is reused this long before asking the provider again. */
const LIVE_CACHE_MS = 30 * 60 * 1000;

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private live: (LiveRate & { at: number }) | null = null;
  private refreshing: Promise<void> | null = null;
  /** Replaceable in tests so no real network call is made. */
  fetchRate: () => Promise<LiveRate | null> = () => fetchLiveRate();

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PricingSettings> {
    const row = await this.prisma.siteContent.findUnique({ where: { key: SETTINGS_KEY } });
    return { ...DEFAULT_PRICING_SETTINGS, ...((row?.value as Partial<PricingSettings> | null) ?? {}) };
  }

  async updateSettings(dto: UpdatePricingSettingsDto): Promise<PricingSettings> {
    if (dto.mode === "manual" && !(dto.manualRate && dto.manualRate > 0)) {
      throw new BadRequestException("Enter the manual exchange rate (kwacha per US dollar).");
    }
    const value: PricingSettings = {
      mode: dto.mode,
      manualRate: dto.manualRate ?? null,
      marginPercent: dto.marginPercent,
      roundMwkTo: dto.roundMwkTo,
    };
    await this.prisma.siteContent.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: value as unknown as Prisma.InputJsonValue },
      create: { key: SETTINGS_KEY, value: value as unknown as Prisma.InputJsonValue },
    });
    return value;
  }

  /** Fetches a fresh live rate now (admin "refresh" button) and remembers it, also across restarts. */
  async refresh(): Promise<LiveRate | null> {
    // Several callers at once share a single provider request.
    this.refreshing ??= (async () => {
      const result = await this.fetchRate();
      if (result) {
        this.live = { ...result, at: Date.now() };
        await this.prisma.siteContent
          .upsert({
            where: { key: LAST_RATE_KEY },
            update: { value: { ...result, at: this.live.at } },
            create: { key: LAST_RATE_KEY, value: { ...result, at: this.live.at } },
          })
          .catch((error) => this.logger.warn(`Could not save the exchange rate: ${error instanceof Error ? error.message : error}`));
      } else {
        this.logger.warn("No exchange-rate source answered; keeping the last known rate.");
      }
    })().finally(() => {
      this.refreshing = null;
    });
    await this.refreshing;
    return this.live;
  }

  /** The most recent live rate we have: memory first, then the copy saved in the database. */
  private async latestLive(): Promise<(LiveRate & { at: number }) | null> {
    if (this.live) return this.live;
    const row = await this.prisma.siteContent.findUnique({ where: { key: LAST_RATE_KEY } });
    const saved = row?.value as (LiveRate & { at: number }) | null | undefined;
    if (saved && typeof saved.rate === "number") this.live = saved;
    return this.live;
  }

  /** The rate the website should use right now, according to the admin's settings. */
  async getEffectiveRate(): Promise<EffectiveRate> {
    const settings = await this.getSettings();

    if (settings.mode === "manual" && settings.manualRate && settings.manualRate > 0) {
      return { rate: settings.manualRate, source: "manual", updatedAt: null, roundMwkTo: settings.roundMwkTo };
    }

    let live = await this.latestLive();
    const stale = !live || Date.now() - live.at > LIVE_CACHE_MS;
    if (stale) {
      const refreshed = await this.refresh();
      live = refreshed ? this.live : live;
    }
    if (!live) return { rate: null, source: "none", updatedAt: null, roundMwkTo: settings.roundMwkTo };

    const withMargin = live.rate * (1 + settings.marginPercent / 100);
    return {
      rate: Math.round(withMargin * 100) / 100,
      // "last-known" = the provider can't be reached right now, so the previous rate is still in use.
      source: Date.now() - live.at > LIVE_CACHE_MS * 4 ? "last-known" : "live",
      updatedAt: new Date(live.at).toISOString(),
      roundMwkTo: settings.roundMwkTo,
    };
  }

  /** Everything the admin page shows: settings, the live rate underneath, and the rate in force. */
  async getAdminOverview() {
    const [settings, effective, live] = await Promise.all([this.getSettings(), this.getEffectiveRate(), this.latestLive()]);
    return { settings, effective, live: live ? { rate: live.rate, provider: live.provider, at: new Date(live.at).toISOString() } : null };
  }

  /**
   * One-time helper for listings entered in kwacha before the site switched to dollars:
   * converts each vehicle and hire vehicle price to USD at the current rate. Prices are
   * rounded to tidy amounts (nearest $50, or $5 for hire rates).
   */
  async convertListingsToUsd(): Promise<{ vehicles: number; hireVehicles: number; rate: number }> {
    const { rate } = await this.getEffectiveRate();
    if (!rate) throw new BadRequestException("No exchange rate is available yet. Set a manual rate first, then try again.");

    const toUsd = (mwk: number, step: number) => Math.max(step, Math.round(mwk / rate / step) * step);

    return this.prisma.$transaction(async (tx) => {
      const vehicles = await tx.vehicle.findMany({ where: { currency: { not: "USD" } }, select: { id: true, price: true } });
      for (const vehicle of vehicles) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { price: toUsd(vehicle.price, 50), currency: "USD" } });
      }
      const hire = await tx.hireVehicle.findMany({ where: { currency: { not: "USD" } }, select: { id: true, dailyRate: true, weeklyRate: true } });
      for (const item of hire) {
        await tx.hireVehicle.update({
          where: { id: item.id },
          data: {
            dailyRate: toUsd(item.dailyRate, 5),
            weeklyRate: item.weeklyRate ? toUsd(item.weeklyRate, 5) : null,
            currency: "USD",
          },
        });
      }
      return { vehicles: vehicles.length, hireVehicles: hire.length, rate };
    });
  }
}
