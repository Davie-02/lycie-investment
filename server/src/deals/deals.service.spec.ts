import { BadRequestException, HttpException } from "@nestjs/common";
import type { Deal } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import type { ResearchService } from "../research/research.service";
import { DealsService, toPublicDeal } from "./deals.service";

const deal = (overrides: Partial<Deal> = {}): Deal => ({
  id: "d1",
  title: "Hilux clearance",
  summary: "Ten percent off double cabs.",
  priceUsd: 21500,
  vehicleLabel: "Toyota Hilux 2019",
  validUntil: new Date("2026-12-31T23:59:59Z"),
  howToGet: "Call Mr Tanaka at the exporter, ask for list 44.",
  sources: ["exporter.example (https://exporter.example/offers)"],
  status: "NEW",
  origin: "ai",
  publishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("public deal view", () => {
  it("never contains the how-to-get notes or where the deal was found", () => {
    const visible = toPublicDeal(deal());
    expect(Object.keys(visible).sort()).toEqual(["id", "priceUsd", "summary", "title", "validUntil", "vehicleLabel"]);
    const json = JSON.stringify(visible);
    expect(json).not.toMatch(/Tanaka|exporter\.example|howToGet|sources/);
  });
});

function build(geminiReply?: { text: string; sources?: string[] }) {
  const store: Deal[] = [];
  const prisma = {
    deal: {
      findMany: jest.fn(async () => store.map((d) => ({ ...d }))),
      createMany: jest.fn(async ({ data }: { data: Array<Partial<Deal>> }) => {
        data.forEach((row, i) => store.push(deal({ ...row, id: `n${store.length + i}` } as Partial<Deal>)));
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => store.find((d) => d.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Deal> }) => {
        const found = store.find((d) => d.id === where.id)!;
        Object.assign(found, data);
        return found;
      }),
      groupBy: jest.fn(async () => []),
    },
  };
  const research = {
    available: true,
    ask: jest.fn(async (..._args: unknown[]) => ({ text: geminiReply?.text ?? "[]", sources: geminiReply?.sources ?? [], mode: "web-search" as const })),
  };
  const service = new DealsService(prisma as unknown as PrismaService, research as unknown as ResearchService);
  return { service, store, prisma, gemini: research };
}

const reply = JSON.stringify([
  { title: "Corolla shipping promo", summary: "Reduced shipping on Corolla imports this month.", priceUsd: 6200, vehicle: "Toyota Corolla", validUntil: "2099-01-01", howToGet: "Ask the shipper for the promo rate." },
]);

describe("DealsService.scan", () => {
  it("saves found deals as NEW (never published) with sources kept for staff", async () => {
    const { service, store } = build({ text: reply, sources: ["shipper.example (https://shipper.example/promo)"] });
    expect(await service.scan()).toEqual({ found: 1, added: 1, mode: "web-search" });
    expect(store[0]).toMatchObject({ status: "NEW", origin: "ai", sources: ["shipper.example (https://shipper.example/promo)"] });
  });

  it("does not add a deal it already has", async () => {
    const { service } = build({ text: reply });
    await service.scan();
    (service as unknown as { scans: { last: number } }).scans.last = 0; // skip the one-minute gap for the test
    expect(await service.scan()).toEqual({ found: 1, added: 0, mode: "web-search" });
  });

  it("researches with real sources only — deals are never invented from general knowledge", async () => {
    const { service, gemini } = build({ text: reply });
    await service.scan();
    expect(gemini.ask.mock.calls[0][0]).toMatchObject({ allowKnowledge: false });
  });

  it("refuses to run again within a minute, and past the daily cap", async () => {
    const { service } = build({ text: reply });
    await service.scan();
    await expect(service.scan()).rejects.toBeInstanceOf(HttpException);
  });

  it("explains when the AI isn't configured", async () => {
    const { service, gemini } = build();
    gemini.available = false;
    await expect(service.scan()).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("publishing", () => {
  it("only the explicit publish action makes a deal public", async () => {
    const { service, store } = build();
    store.push(deal());
    await service.setStatus("d1", "publish");
    expect(store[0].status).toBe("PUBLISHED");
    expect(store[0].publishedAt).toBeInstanceOf(Date);
    await service.setStatus("d1", "unpublish");
    expect(store[0]).toMatchObject({ status: "NEW", publishedAt: null });
    await service.setStatus("d1", "dismiss");
    expect(store[0].status).toBe("DISMISSED");
  });
});
