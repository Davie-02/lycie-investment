import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeminiBlockedError, GeminiClient, GeminiUnavailableError } from "../lycie/gemini.client";
import { buildDemand, type DemandRow } from "./demand";
import { parseReport, type MarketReportContent } from "./report.parser";

const DEMAND_WINDOW_DAYS = 90;
/** Regenerating the AI briefing is limited so it can't burn the free AI quota. */
const REPORT_MIN_GAP_MS = 30 * 60 * 1000;

const SYSTEM_PROMPT = `You are a strategy analyst for Lycie Investments, a company in Malawi that imports, sells, hires and clears vehicles.
Use Google Search to research, right now: which used vehicles (makes, models, body types) are most in demand and being bought in Malawi and Southern Africa, their typical prices in US dollars, what competing importers and dealers usually offer, and where they tend to fall short (price transparency, delivery time, after-sales, financing, communication).
Combine that with the company's own demand data supplied by the user, and give practical advice to help the company win more customers than its competitors.

Reply with ONLY one JSON object (no other text):
{
 "headline": one or two sentences summarising the market right now,
 "trending": [ up to 6 { "name": vehicle, "why": short reason, "typicalPriceUsd": number or null } ],
 "opportunities": [ up to 6 { "action": something concrete the company should do, "why": short reason } ],
 "standOut": [ up to 5 { "idea": a way to beat other importers/dealers, "why": short reason } ]
}
Base everything on search results and the data given. Do not invent statistics. Keep each string short and plain.`;

/** Market intelligence for the admin: what the company's own customers want, plus an AI briefing with live research. */
@Injectable()
export class MarketService {
  private lastReportAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiClient
  ) {}

  /** Ranked demand from the company's own data over the last 90 days. */
  async demand(): Promise<{ windowDays: number; rows: DemandRow[] }> {
    const since = new Date(Date.now() - DEMAND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [vehicles, importRequests, inquiries, saves, likes, views] = await Promise.all([
      this.prisma.vehicle.findMany({ where: { archivedAt: null }, select: { id: true, make: true, model: true, status: true } }),
      this.prisma.importRequest.findMany({ where: { createdAt: { gte: since } }, select: { preferredMake: true, preferredModel: true } }),
      this.prisma.inquiry.findMany({ where: { createdAt: { gte: since }, vehicleId: { not: null } }, select: { vehicleId: true } }),
      this.prisma.savedVehicle.findMany({ where: { createdAt: { gte: since } }, select: { vehicleId: true } }),
      this.prisma.contentLike.findMany({ where: { kind: "vehicle", createdAt: { gte: since } }, select: { targetId: true } }),
      this.prisma.vehicleViewStat.groupBy({ by: ["vehicleId"], where: { day: { gte: since } }, _sum: { views: true } }),
    ]);

    return {
      windowDays: DEMAND_WINDOW_DAYS,
      rows: buildDemand({
        vehicles,
        importRequests,
        inquiries,
        saves,
        likes,
        views: views.map((row) => ({ vehicleId: row.vehicleId, views: row._sum.views ?? 0 })),
      }),
    };
  }

  /** The most recent AI briefing, if any has been generated. */
  async latestReport(): Promise<{ content: MarketReportContent; sources: string[]; createdAt: string } | null> {
    const report = await this.prisma.marketReport.findFirst({ orderBy: { createdAt: "desc" } });
    if (!report) return null;
    return { content: report.content as unknown as MarketReportContent, sources: report.sources, createdAt: report.createdAt.toISOString() };
  }

  get aiAvailable(): boolean {
    return this.gemini.isConfigured;
  }

  /** Researches the market on the web, blends in the company's own demand, and saves a fresh briefing. */
  async generateReport() {
    if (!this.gemini.isConfigured) throw new BadRequestException("The AI research isn't set up yet (GEMINI_API_KEY is missing).");
    if (Date.now() - this.lastReportAt < REPORT_MIN_GAP_MS) {
      throw new HttpException("A briefing was generated a few minutes ago. Give it a while before asking again.", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.lastReportAt = Date.now();

    const { rows } = await this.demand();
    const ownData = rows.length
      ? rows.slice(0, 8).map((row) => `- ${row.name}: ${row.importRequests} import requests, ${row.inquiries} inquiries, ${row.saves} saves, ${row.views} views, ${row.inStock} in stock`).join("\n")
      : "(the company has little demand data yet)";

    let reply;
    try {
      reply = await this.gemini.generate(
        SYSTEM_PROMPT,
        [{ role: "user", text: `Today is ${new Date().toISOString().slice(0, 10)}.\nThe company's own demand over the last ${DEMAND_WINDOW_DAYS} days:\n${ownData}\n\nWrite the market briefing now.` }],
        { search: true, maxOutputTokens: 2500, temperature: 0.3, timeoutMs: 45_000 }
      );
    } catch (error) {
      this.lastReportAt = 0; // a failed attempt shouldn't lock the button
      if (error instanceof GeminiBlockedError) throw new BadRequestException("The request was declined by the AI provider. Try again later.");
      if (error instanceof GeminiUnavailableError) throw new HttpException("The AI research is busy right now. Please try again in a few minutes.", HttpStatus.SERVICE_UNAVAILABLE);
      throw error;
    }

    const content = parseReport(reply.text);
    if (!content) {
      this.lastReportAt = 0;
      throw new HttpException("The AI answered in a format we couldn't read. Please try again.", HttpStatus.BAD_GATEWAY);
    }

    const saved = await this.prisma.marketReport.create({
      data: { content: content as unknown as Prisma.InputJsonValue, sources: reply.sources ?? [] },
    });
    return { content, sources: saved.sources, createdAt: saved.createdAt.toISOString() };
  }
}
