import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "./pricing.service";
import { fetchLiveRate, isPlausibleRate } from "./rate-providers";

/** A tiny in-memory stand-in for the two Prisma calls the service makes (SiteContent rows). */
function fakePrisma(initial: Record<string, unknown> = {}) {
  const rows = new Map<string, unknown>(Object.entries(initial));
  const prisma: Record<string, any> = { // eslint-disable-line @typescript-eslint/no-explicit-any
    siteContent: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) => (rows.has(where.key) ? { key: where.key, value: rows.get(where.key) } : null)),
      upsert: jest.fn(async ({ where, create }: { where: { key: string }; create: { value: unknown } }) => {
        rows.set(where.key, create.value);
      }),
    },
    vehicle: { findMany: jest.fn(), update: jest.fn() },
    hireVehicle: { findMany: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
  };
  return { prisma, rows };
}

const serviceWith = (initial?: Record<string, unknown>, live: number | null = 1750) => {
  const { prisma, rows } = fakePrisma(initial);
  const service = new PricingService(prisma as unknown as PrismaService);
  service.fetchRate = jest.fn(async () => (live ? { rate: live, provider: "test" } : null));
  return { service, prisma, rows };
};

describe("PricingService.getEffectiveRate", () => {
  it("uses the live rate in auto mode and remembers it", async () => {
    const { service, rows } = serviceWith();
    const result = await service.getEffectiveRate();
    expect(result).toMatchObject({ rate: 1750, source: "live", roundMwkTo: 1000 });
    expect(rows.has("pricing-rate")).toBe(true);
  });

  it("applies the admin's margin on top of the live rate", async () => {
    const { service } = serviceWith({ pricing: { mode: "auto", marginPercent: 10, roundMwkTo: 100 } });
    expect((await service.getEffectiveRate()).rate).toBe(1925);
  });

  it("uses the manual rate, and never contacts the provider, in manual mode", async () => {
    const { service } = serviceWith({ pricing: { mode: "manual", manualRate: 4200, marginPercent: 0, roundMwkTo: 1000 } });
    expect(await service.getEffectiveRate()).toMatchObject({ rate: 4200, source: "manual" });
    expect(service.fetchRate).not.toHaveBeenCalled();
  });

  it("reuses the live rate for a while instead of calling the provider on every visit", async () => {
    const { service } = serviceWith();
    await service.getEffectiveRate();
    await service.getEffectiveRate();
    await service.getEffectiveRate();
    expect(service.fetchRate).toHaveBeenCalledTimes(1);
  });

  it("falls back to the last saved rate when the provider is unreachable", async () => {
    const { service } = serviceWith({ "pricing-rate": { rate: 1700, provider: "old", at: Date.now() - 60 * 60 * 1000 } }, null);
    expect(await service.getEffectiveRate()).toMatchObject({ rate: 1700 });
  });

  it("reports no rate (site shows dollars only) when nothing is known at all", async () => {
    const { service } = serviceWith({}, null);
    expect(await service.getEffectiveRate()).toMatchObject({ rate: null, source: "none" });
  });

  it("shares one provider request between simultaneous visitors", async () => {
    const { service } = serviceWith();
    await Promise.all([service.getEffectiveRate(), service.getEffectiveRate(), service.getEffectiveRate()]);
    expect(service.fetchRate).toHaveBeenCalledTimes(1);
  });
});

describe("PricingService.updateSettings", () => {
  it("requires a rate when switching to manual", async () => {
    const { service } = serviceWith();
    await expect(service.updateSettings({ mode: "manual", marginPercent: 0, roundMwkTo: 1000 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("saves valid settings", async () => {
    const { service, rows } = serviceWith();
    await service.updateSettings({ mode: "manual", manualRate: 4000, marginPercent: 2, roundMwkTo: 500 });
    expect(rows.get("pricing")).toEqual({ mode: "manual", manualRate: 4000, marginPercent: 2, roundMwkTo: 500 });
  });
});

describe("PricingService.convertListingsToUsd", () => {
  it("converts kwacha listings to tidy dollar amounts", async () => {
    const { service, prisma } = serviceWith({ pricing: { mode: "manual", manualRate: 2000, marginPercent: 0, roundMwkTo: 1000 } });
    prisma.vehicle.findMany.mockResolvedValue([{ id: "v1", price: 52_000_000 }]); // 26,000 USD
    prisma.hireVehicle.findMany.mockResolvedValue([{ id: "h1", dailyRate: 120_000, weeklyRate: null }]); // 60 USD
    const result = await service.convertListingsToUsd();
    expect(result).toEqual({ vehicles: 1, hireVehicles: 1, rate: 2000 });
    expect(prisma.vehicle.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { price: 26000, currency: "USD" } });
    expect(prisma.hireVehicle.update).toHaveBeenCalledWith({ where: { id: "h1" }, data: { dailyRate: 60, weeklyRate: null, currency: "USD" } });
  });

  it("refuses when there is no rate to convert with", async () => {
    const { service } = serviceWith({}, null);
    await expect(service.convertListingsToUsd()).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("rate providers", () => {
  it("accepts only believable kwacha rates", () => {
    expect(isPlausibleRate(1750)).toBe(true);
    for (const bad of [0, -5, NaN, Infinity, "1750", null, 5, 9_999_999]) expect(isPlausibleRate(bad)).toBe(false);
  });

  it("uses the second source when the first is down", async () => {
    const fetchFn = jest.fn(async (url: string | URL | Request) =>
      String(url).includes("er-api") ? new Response("nope", { status: 503 }) : new Response(JSON.stringify({ usd: { mwk: 1745.5 } }), { status: 200 })
    );
    expect(await fetchLiveRate(fetchFn as unknown as typeof fetch)).toEqual({ rate: 1745.5, provider: "currency-api (jsDelivr)" });
  });

  it("ignores an absurd answer and returns null when no source works", async () => {
    const fetchFn = jest.fn(async () => new Response(JSON.stringify({ rates: { MWK: 3 }, usd: { mwk: 3 } }), { status: 200 }));
    expect(await fetchLiveRate(fetchFn as unknown as typeof fetch)).toBeNull();
  });
});
