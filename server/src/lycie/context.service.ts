import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PricingService } from "../pricing/pricing.service";
import { priceText } from "../pricing/price-format";
import { PUBLIC } from "../content-admin/content-state";
import { HireInfo, LycieContext, VehicleInfo } from "./prompt.builder";
import { KnowledgeItem, selectKnowledge } from "./knowledge-select.util";

const CACHE_TTL_MS = 45_000;
const MAX_VEHICLES = 40;

export interface VehicleCard {
  slug: string;
  label: string;
  price: number;
  currency: string;
  image: string | null;
  status: string;
}

interface Snapshot {
  builtAt: number;
  company: LycieContext["company"];
  vehicles: VehicleInfo[];
  cards: Map<string, VehicleCard>;
  hireVehicles: HireInfo[];
  /** Admin knowledge entries first, then FAQ. `ids` maps a KnowledgeEntry id to its item. */
  knowledge: KnowledgeItem[];
  knowledgeById: Map<string, KnowledgeItem>;
}

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asStrings = (value: unknown): string[] => asArray(value).map((v) => asString(v)).filter(Boolean);

/**
 * Gathers everything Lycie is allowed to know about the company, straight
 * from the database, so an admin's edit in the CMS shows up in chat without
 * any code change. A short cache keeps chat fast; knowledge edits clear it
 * immediately and other CMS edits appear within CACHE_TTL_MS.
 */
@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);
  private snapshot: Snapshot | null = null;
  private loading: Promise<Snapshot> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService
  ) {}

  /** Bumps every time admin content that Lycie learns from changes; used to discard cached answers. */
  private invalidations = 0;

  get version(): number {
    return this.invalidations;
  }

  invalidate(): void {
    this.invalidations += 1;
    this.snapshot = null;
  }

  async forQuestion(question: string): Promise<{ context: LycieContext; cards: Map<string, VehicleCard> }> {
    const snap = await this.load();
    const budget = Number(process.env.LYCIE_KNOWLEDGE_CHARS) || 12_000;
    const totalChars = snap.knowledge.reduce((n, k) => n + k.title.length + k.content.length + 20, 0);

    // Only pay for a database search when everything can't fit in the prompt.
    const matches = totalChars > budget ? await this.fullTextMatches(question, snap) : [];

    return {
      context: {
        company: snap.company,
        vehicles: snap.vehicles,
        hireVehicles: snap.hireVehicles,
        knowledge: selectKnowledge(snap.knowledge, question, budget, matches),
      },
      cards: snap.cards,
    };
  }

  /** Contact line for the "AI unavailable" fallback message. */
  async contact(): Promise<LycieContext["company"]["contact"]> {
    return (await this.load()).company.contact;
  }

  private async load(): Promise<Snapshot> {
    if (this.snapshot && Date.now() - this.snapshot.builtAt < CACHE_TTL_MS) return this.snapshot;
    // Concurrent chats share one rebuild instead of stampeding the database.
    this.loading ??= this.build().finally(() => {
      this.loading = null;
    });
    this.snapshot = await this.loading;
    return this.snapshot;
  }

  private async build(): Promise<Snapshot> {
    const [siteRows, vehicles, hire, entries, faqs] = await Promise.all([
      this.prisma.siteContent.findMany(),
      this.prisma.vehicle.findMany({
        where: { ...PUBLIC.vehicles, status: { in: ["available", "reserved"] } },
        orderBy: { createdAt: "desc" },
        take: MAX_VEHICLES,
      }),
      this.prisma.hireVehicle.findMany({ where: PUBLIC["hire-vehicles"], orderBy: { createdAt: "asc" } }),
      this.prisma.knowledgeEntry.findMany({ where: { isActive: true }, orderBy: { updatedAt: "desc" } }),
      this.prisma.faq.findMany({ where: PUBLIC.faq, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);

    const site = Object.fromEntries(siteRows.map((row) => [row.key, asRecord(row.value)]));
    const contact = asRecord(site.contact);
    const about = asRecord(site.about);
    const clearing = asRecord(site.clearingPage);
    const companyInfo = asRecord(site.company);

    const company: LycieContext["company"] = {
      contact: {
        phone: asString(contact.phone, "Contact our team for current details"),
        email: asString(contact.email, "hello@lycieinvestment.com"),
        address: asString(contact.address, "Lilongwe, Malawi"),
        businessHours: asString(contact.businessHours, "Monday – Friday, 8:00 – 17:00"),
        whatsappNumber: asString(contact.whatsappNumber) || null,
      },
      about: [about.intro, about.whatWeDo, about.howWeWork, about.whyChooseUs].map((v) => asString(v)).filter(Boolean),
      services: asArray(asRecord(site.services).items)
        .map((item) => asRecord(item))
        .map((item) => ({ title: asString(item.title), description: asString(item.description) }))
        .filter((item) => item.title),
      process: asArray(asRecord(site.journey).steps)
        .map((step) => asRecord(step))
        .map((step) => [asString(step.title), asString(step.detail)].filter(Boolean).join(" — "))
        .filter(Boolean),
      clearing: { disclaimer: asString(clearing.disclaimer), areas: asStrings(clearing.areas) },
      background: [
        companyInfo.name && companyInfo.established ? `${asString(companyInfo.name)}, established ${companyInfo.established}.` : "",
        ...asStrings(companyInfo.story),
        asString(companyInfo.vision) ? `Vision: ${asString(companyInfo.vision)}` : "",
        ...asStrings(companyInfo.missionPoints).map((point) => `Mission: ${point}`),
        ...asArray(companyInfo.values).map((v) => asRecord(v)).map((v) => `Value — ${asString(v.title)}: ${asString(v.detail)}`),
      ].filter(Boolean),
      team: asArray(asRecord(site.team).groups)
        .map((g) => asRecord(g))
        .flatMap((g) => asArray(g.members).map((m) => asRecord(m)))
        .map((m) => [asString(m.name), asString(m.role)].filter(Boolean).join(" — "))
        .filter(Boolean),
      clients: asArray(asRecord(site.clients).items)
        .map((c) => asRecord(c))
        .map((c) => `${asString(c.title)}: ${asString(c.detail)}`)
        .filter((line) => line !== ": "),
      fleet: asArray(asRecord(site.fleet).items)
        .map((f) => asRecord(f))
        .map((f) => [asString(f.title), asString(f.caption)].filter(Boolean).join(" — "))
        .filter(Boolean),
    };

    // One exchange rate for the whole snapshot, so every price Lycie quotes is consistent.
    const { rate, roundMwkTo } = await this.pricing.getEffectiveRate();
    const money = (amount: number, currency: string) => priceText(amount, currency, rate, roundMwkTo);

    const cards = new Map<string, VehicleCard>();
    const vehicleInfo: VehicleInfo[] = vehicles.map((v) => {
      const label = `${v.make} ${v.model} ${v.year}`;
      cards.set(v.slug, { slug: v.slug, label, price: v.price, currency: v.currency, image: v.images[0] ?? null, status: v.status });
      return {
        slug: v.slug,
        label,
        priceText: money(v.price, v.currency),
        mileageKm: v.mileageKm,
        fuelType: v.fuelType,
        transmission: v.transmission,
        bodyType: v.bodyType,
        status: v.status,
        location: v.location,
      };
    });

    const knowledgeById = new Map<string, KnowledgeItem>();
    const knowledge: KnowledgeItem[] = [];
    for (const entry of entries) {
      const item = { title: entry.title, category: entry.category, content: entry.content };
      knowledgeById.set(entry.id, item);
      knowledge.push(item);
    }
    for (const faq of faqs) {
      knowledge.push({ title: faq.question, category: "faq", content: faq.answer });
    }

    return {
      builtAt: Date.now(),
      company,
      vehicles: vehicleInfo,
      cards,
      hireVehicles: hire.map((h) => ({
        name: h.name,
        dailyText: money(h.dailyRate, h.currency),
        weeklyText: h.weeklyRate ? money(h.weeklyRate, h.currency) : null,
        seats: h.seats,
        transmission: h.transmission,
        fuelType: h.fuelType,
        available: h.available,
      })),
      knowledge,
      knowledgeById,
    };
  }

  /** Top full-text matches among admin knowledge entries, best first. */
  private async fullTextMatches(question: string, snap: Snapshot): Promise<KnowledgeItem[]> {
    try {
      // Parameterised — the question is never concatenated into SQL.
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "KnowledgeEntry"
        WHERE "isActive" = true
          AND to_tsvector('english', "title" || ' ' || "content") @@ websearch_to_tsquery('english', ${question})
        ORDER BY ts_rank(to_tsvector('english', "title" || ' ' || "content"), websearch_to_tsquery('english', ${question})) DESC
        LIMIT 10`);
      return rows.map((row) => snap.knowledgeById.get(row.id)).filter((item): item is KnowledgeItem => Boolean(item));
    } catch (error) {
      // Search is an optimisation — keyword overlap still ranks the rest.
      this.logger.warn(`Knowledge full-text search failed: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }
}
