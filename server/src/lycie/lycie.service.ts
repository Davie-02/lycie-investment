import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContextService, VehicleCard } from "./context.service";
import { ChatTurn, GeminiBlockedError, GeminiClient } from "./gemini.client";
import { AnswerCache } from "./answer-cache.util";
import { MarkerFilter } from "./marker-filter.util";
import { buildSystemPrompt, wrapCustomerMessage } from "./prompt.builder";
import { redactPii } from "./pii.util";
import { parseReply } from "./reply.util";
import { DailyCounter, WindowLimiter } from "./limits.util";
import { ChatDto } from "./dto/chat.dto";
import { CreateKnowledgeDto, UpdateKnowledgeDto } from "./dto/knowledge.dto";

export type ChatOutcome = "answered" | "no_info" | "unavailable" | "blocked" | "limited";

export interface ChatResponse {
  reply: string;
  vehicles: VehicleCard[];
  outcome: ChatOutcome;
  /** Lets the widget attach thumbs-up/down to this exchange. Null when nothing was logged. */
  logId: string | null;
}

const numberFromEnv = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

@Injectable()
export class LycieService {
  private readonly logger = new Logger(LycieService.name);
  private readonly perIp = new WindowLimiter(numberFromEnv("LYCIE_HOURLY_LIMIT_PER_IP", 40), 60 * 60_000);
  private readonly today = new DailyCounter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContextService,
    private readonly gemini: GeminiClient
  ) {}

  /** Answers to recent standalone questions, so repeats are instant and free (see answer-cache.util.ts). */
  private readonly answers = new AnswerCache<{ text: string; vehicles: VehicleCard[] }>(5 * 60 * 1000);

  /** Cache key: the question plus the knowledge version, so any admin change starts a fresh set of answers. */
  private cacheKey(question: string): string {
    return `v${this.context.version} ${question}`;
  }

  /** Live check of every AI model from this server (admin "AI connection check"). */
  diagnose() {
    return this.gemini.diagnose();
  }

  /** The models in use and how racing is set, so an admin can see the real configuration. */
  get aiSettings() {
    return this.gemini.settings;
  }

  get isEnabled(): boolean {
    return this.gemini.isConfigured;
  }

  /**
   * Answers one question. If `onDelta` is given, the answer is streamed: each
   * piece of text is passed to it as soon as it's produced (with our internal
   * markers already removed). The returned response always carries the final,
   * tidied text, which the caller should treat as authoritative.
   */
  async chat(dto: ChatDto, ip: string, onDelta?: (text: string) => void): Promise<ChatResponse> {
    const question = redactPii(dto.message.trim());
    if (!question) return this.refuse("Please type a question and I'll do my best to help.", "blocked", null);

    const contact = await this.context.contact();
    const fallback = () =>
      `I'm having trouble answering right now. Our team can help directly — call ${contact.phone}, email ${contact.email}${
        contact.whatsappNumber ? `, or message us on WhatsApp at ${contact.whatsappNumber}` : ""
      } (${contact.businessHours}).`;

    if (!this.gemini.isConfigured) return this.log(question, fallback(), null, "unavailable");

    if (!this.perIp.allow(ip)) {
      return this.refuse(
        "You've asked a lot of questions in a short time. Please try again a little later, or contact our team directly.",
        "limited",
        null
      );
    }
    if (await this.dailyCapReached()) {
      return this.log(question, fallback(), null, "unavailable");
    }

    // A standalone question we answered a moment ago: reply instantly, no AI call, no quota used.
    const isStandalone = !dto.history || dto.history.length === 0;
    if (isStandalone) {
      const cached = this.answers.get(this.cacheKey(question));
      if (cached) {
        onDelta?.(cached.text);
        return this.log(question, cached.text, "cache", "answered", cached.vehicles);
      }
    }

    const { context, cards } = await this.context.forQuestion(question);
    const turns: ChatTurn[] = [
      ...(dto.history ?? []).map((turn) => ({
        role: turn.role,
        text: turn.role === "user" ? wrapCustomerMessage(redactPii(turn.text)) : redactPii(turn.text),
      })),
      { role: "user", text: wrapCustomerMessage(question) },
    ];

    try {
      const system = buildSystemPrompt(context);
      let result;
      if (onDelta) {
        const filter = new MarkerFilter();
        result = await this.gemini.generateStream(system, turns, (delta) => {
          const safe = filter.push(delta);
          if (safe) onDelta(safe);
        });
        const rest = filter.end();
        if (rest) onDelta(rest);
      } else {
        result = await this.gemini.generate(system, turns);
      }
      const { text, model } = result;
      this.today.increment();
      const parsed = parseReply(text, new Set(cards.keys()));
      const vehicles = parsed.vehicleSlugs.map((slug) => cards.get(slug)).filter((c): c is VehicleCard => Boolean(c));
      // Remember good, standalone answers (never fallbacks or "I don't know") for the next visitor.
      if (isStandalone && parsed.text && !parsed.noInfo) this.answers.set(this.cacheKey(question), { text: parsed.text, vehicles });
      return this.log(question, parsed.text || fallback(), model, parsed.noInfo ? "no_info" : "answered", vehicles);
    } catch (error) {
      if (error instanceof GeminiBlockedError) {
        return this.log(
          question,
          "I can't help with that one. I'm happy to answer questions about our vehicles, hire, importing and clearing.",
          null,
          "blocked"
        );
      }
      this.logger.warn(`Lycie could not answer: ${error instanceof Error ? error.message : error}`);
      return this.log(question, fallback(), null, "unavailable");
    }
  }

  async feedback(logId: string, helpful: boolean): Promise<void> {
    const result = await this.prisma.lycieChatLog.updateMany({ where: { id: logId }, data: { helpful } });
    if (result.count === 0) throw new NotFoundException("Conversation not found.");
  }

  // ---- admin: knowledge base ----

  async listKnowledge() {
    const [items, faqCount] = await Promise.all([
      // Notes only — sections of uploaded files are listed under Documents.
      this.prisma.knowledgeEntry.findMany({ where: { documentId: null }, orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }] }),
      this.prisma.faq.count(),
    ]);
    // The budget counts everything Lycie can draw on: notes AND sections of uploaded files.
    const active = await this.prisma.knowledgeEntry.findMany({ where: { isActive: true }, select: { title: true, content: true } });
    const activeChars = active.reduce((n, i) => n + i.title.length + i.content.length + 20, 0);
    return {
      items,
      faqCount,
      activeChars,
      budgetChars: numberFromEnv("LYCIE_KNOWLEDGE_CHARS", 12_000),
    };
  }

  async createKnowledge(dto: CreateKnowledgeDto) {
    const entry = await this.prisma.knowledgeEntry.create({ data: dto });
    this.context.invalidate();
    return entry;
  }

  async updateKnowledge(id: string, dto: UpdateKnowledgeDto) {
    await this.ensureKnowledge(id);
    const entry = await this.prisma.knowledgeEntry.update({ where: { id }, data: dto });
    this.context.invalidate();
    return entry;
  }

  async removeKnowledge(id: string) {
    await this.ensureKnowledge(id);
    await this.prisma.knowledgeEntry.delete({ where: { id } });
    this.context.invalidate();
  }

  // ---- admin: conversations & gaps ----

  async analytics(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);
    const [grouped, helpful, notHelpful, gaps, recent] = await Promise.all([
      this.prisma.lycieChatLog.groupBy({ by: ["outcome"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.lycieChatLog.count({ where: { createdAt: { gte: since }, helpful: true } }),
      this.prisma.lycieChatLog.count({ where: { createdAt: { gte: since }, helpful: false } }),
      // "Gaps": Lycie said it lacked the info, or a customer marked the answer unhelpful.
      this.prisma.lycieChatLog.findMany({
        where: { createdAt: { gte: since }, OR: [{ outcome: "no_info" }, { helpful: false }] },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.lycieChatLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    ]);

    const counts = Object.fromEntries(grouped.map((g) => [g.outcome, g._count._all]));
    return {
      days,
      total: grouped.reduce((n, g) => n + g._count._all, 0),
      outcomes: counts,
      helpful,
      notHelpful,
      gaps,
      recent,
    };
  }

  // ---- housekeeping ----

  async purgeOldLogs(): Promise<number> {
    const days = numberFromEnv("LYCIE_LOG_RETENTION_DAYS", 90);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000);
    const [logs, submissions] = await Promise.all([
      this.prisma.lycieChatLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      this.prisma.visitorSubmission.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ]);
    return logs.count + submissions.count;
  }

  // ---- internals ----

  private async dailyCapReached(): Promise<boolean> {
    const cap = numberFromEnv("LYCIE_DAILY_LIMIT", 300);
    if (!this.today.seeded) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      this.today.set(
        await this.prisma.lycieChatLog.count({
          where: { createdAt: { gte: start }, outcome: { in: ["answered", "no_info"] } },
        })
      );
    }
    return this.today.value >= cap;
  }

  private refuse(reply: string, outcome: ChatOutcome, logId: string | null): ChatResponse {
    return { reply, vehicles: [], outcome, logId };
  }

  private async log(
    question: string,
    answer: string,
    model: string | null,
    outcome: ChatOutcome,
    vehicles: VehicleCard[] = []
  ): Promise<ChatResponse> {
    let logId: string | null = null;
    try {
      const row = await this.prisma.lycieChatLog.create({ data: { question, answer, model, outcome } });
      logId = row.id;
    } catch (error) {
      // Logging must never stop a customer getting their answer.
      this.logger.warn(`Could not log chat: ${error instanceof Error ? error.message : error}`);
    }
    return { reply: answer, vehicles, outcome, logId };
  }

  private async ensureKnowledge(id: string) {
    const existing = await this.prisma.knowledgeEntry.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException("Knowledge entry not found.");
  }
}
