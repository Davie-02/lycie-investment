import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Deal, DealStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeminiBlockedError, GeminiClient, GeminiUnavailableError } from "../lycie/gemini.client";
import { parseDeals } from "./deals.parser";
import { CreateDealDto, UpdateDealDto } from "./dto/deal.dto";

/** What a visitor may see of a deal — deliberately NOT including how-to-get notes or sources. */
export interface PublicDeal {
  id: string;
  title: string;
  summary: string;
  priceUsd: number | null;
  vehicleLabel: string | null;
  validUntil: string | null;
}

export function toPublicDeal(deal: Deal): PublicDeal {
  return {
    id: deal.id,
    title: deal.title,
    summary: deal.summary,
    priceUsd: deal.priceUsd,
    vehicleLabel: deal.vehicleLabel,
    validUntil: deal.validUntil ? deal.validUntil.toISOString() : null,
  };
}

const SYSTEM_PROMPT = `You are a market researcher for Lycie Investments, a company in Malawi that imports, sells, hires and clears vehicles.
Use Google Search to find CURRENT (not old) deals that could help the company or its customers get vehicles for less: manufacturer or dealer promotions, exporter clearance sales, auction bargains, shipping or import promotions, and price drops on popular vehicles for the Malawian / Southern African market (typically exported from Japan, the UK, South Africa or the UAE).

Reply with ONLY a JSON array (no other text) of up to 8 objects, each with:
- "title": short headline, max 80 characters
- "summary": 1-2 sentences for CUSTOMERS describing the offer. It must NOT contain any company name, website, web address, email or phrase like "according to". Write it as an offer Lycie Investments can arrange.
- "priceUsd": the headline price in US dollars as a number, or null
- "vehicle": the vehicle it applies to (e.g. "Toyota Hilux 2019"), or null
- "validUntil": end date as YYYY-MM-DD, or null if unknown
- "howToGet": for STAFF ONLY — concrete steps to actually get this deal: who to contact, what to ask for, deadlines, conditions.
Only include deals you actually found in search results. Never invent prices, dates or offers. If you find nothing solid, return [].`;

const DAILY_SCANS = () => Math.max(1, Number(process.env.DEALS_DAILY_SCANS) || 6);
const MIN_GAP_MS = 60_000;

/**
 * The admin-only deals desk.
 *  - scan(): asks Gemini (with live Google Search) for current vehicle deals and saves them as NEW
 *    for a person to review. Nothing is ever published automatically.
 *  - Staff edit the wording, then publish or dismiss. Only PUBLISHED, unexpired deals are public,
 *    and the public view never includes where a deal came from or how to get it.
 */
@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);
  private scans = { day: "", count: 0, last: 0 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiClient
  ) {}

  get aiAvailable(): boolean {
    return this.gemini.isConfigured;
  }

  /** Public list: published and not yet expired, newest first. */
  async listPublic(): Promise<PublicDeal[]> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const deals = await this.prisma.deal.findMany({
      where: { status: "PUBLISHED", OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }] },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });
    return deals.map(toPublicDeal);
  }

  /** Admin list with everything, optionally filtered by status. */
  async listAdmin(status?: DealStatus) {
    const [deals, counts] = await Promise.all([
      this.prisma.deal.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200 }),
      this.prisma.deal.groupBy({ by: ["status"], _count: true }),
    ]);
    return {
      deals,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count])),
      aiAvailable: this.aiAvailable,
    };
  }

  /** Enforces a daily cap and a short gap between scans, protecting the AI quota. */
  private allowScan(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.scans.day !== today) this.scans = { day: today, count: 0, last: this.scans.last };
    if (Date.now() - this.scans.last < MIN_GAP_MS) throw new HttpException("A search just ran — give it a minute.", HttpStatus.TOO_MANY_REQUESTS);
    if (this.scans.count >= DAILY_SCANS()) throw new HttpException(`The daily limit of ${DAILY_SCANS()} deal searches has been reached. Try again tomorrow.`, HttpStatus.TOO_MANY_REQUESTS);
    this.scans.count += 1;
    this.scans.last = Date.now();
  }

  /** Searches the web for current deals and saves new ones for review. Returns what was found. */
  async scan(): Promise<{ found: number; added: number }> {
    if (!this.gemini.isConfigured) throw new BadRequestException("The AI search isn't set up yet (GEMINI_API_KEY is missing).");
    this.allowScan();

    let reply;
    try {
      reply = await this.gemini.generate(
        SYSTEM_PROMPT,
        [{ role: "user", text: `Today is ${new Date().toISOString().slice(0, 10)}. Find current vehicle deals now.` }],
        { search: true, maxOutputTokens: 2500, temperature: 0.3, timeoutMs: 40_000 }
      );
    } catch (error) {
      if (error instanceof GeminiBlockedError) throw new BadRequestException("The search was declined by the AI provider. Try again later.");
      if (error instanceof GeminiUnavailableError) throw new HttpException("The AI search is busy right now. Please try again in a few minutes.", HttpStatus.SERVICE_UNAVAILABLE);
      throw error;
    }

    const candidates = parseDeals(reply.text);
    const existing = new Set((await this.prisma.deal.findMany({ select: { title: true } })).map((deal) => deal.title.toLowerCase()));
    const fresh = candidates.filter((candidate) => !existing.has(candidate.title.toLowerCase()));

    if (fresh.length > 0) {
      await this.prisma.deal.createMany({
        data: fresh.map((candidate) => ({ ...candidate, sources: reply.sources ?? [], origin: "ai", status: "NEW" as const })),
      });
    }
    this.logger.log(`Deal search: ${candidates.length} found, ${fresh.length} new.`);
    return { found: candidates.length, added: fresh.length };
  }

  create(dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        title: dto.title.trim(),
        summary: dto.summary.trim(),
        priceUsd: dto.priceUsd ?? null,
        vehicleLabel: dto.vehicleLabel?.trim() || null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        howToGet: dto.howToGet?.trim() ?? "",
        origin: "manual",
      },
    });
  }

  async update(id: string, dto: UpdateDealDto) {
    await this.ensureExists(id);
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
        ...(dto.priceUsd !== undefined ? { priceUsd: dto.priceUsd } : {}),
        ...(dto.vehicleLabel !== undefined ? { vehicleLabel: dto.vehicleLabel?.trim() || null } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null } : {}),
        ...(dto.howToGet !== undefined ? { howToGet: dto.howToGet } : {}),
      },
    });
  }

  async setStatus(id: string, action: "publish" | "unpublish" | "dismiss") {
    await this.ensureExists(id);
    const data =
      action === "publish" ? { status: "PUBLISHED" as const, publishedAt: new Date() } : action === "unpublish" ? { status: "NEW" as const, publishedAt: null } : { status: "DISMISSED" as const, publishedAt: null };
    return this.prisma.deal.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.deal.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.deal.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException("Deal not found.");
  }
}
