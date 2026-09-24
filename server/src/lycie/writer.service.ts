import { HttpException, HttpStatus, Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import { ContextService } from "./context.service";
import { GeminiBlockedError, GeminiClient, GeminiUnavailableError } from "./gemini.client";
import { DailyCounter } from "./limits.util";
import { WRITER_KINDS, buildWriterPrompt, buildWriterRequest, cleanWriterOutput } from "./prompt.builder";
import { WriteDto } from "./dto/write.dto";

const DAILY_LIMIT = Number(process.env.LYCIE_WRITE_DAILY_LIMIT) || 150;

/**
 * "Write with AI" for the admin CMS. Drafts text from the company's own data
 * plus whatever the admin supplies; the admin always reviews and edits it
 * before it goes anywhere near the public site (nothing is saved here).
 */
@Injectable()
export class WriterService {
  private readonly logger = new Logger(WriterService.name);
  private readonly today = new DailyCounter();

  constructor(
    private readonly context: ContextService,
    private readonly gemini: GeminiClient
  ) {}

  async write(dto: WriteDto): Promise<{ text: string; model: string }> {
    if (!this.gemini.isConfigured) {
      throw new UnprocessableEntityException("The AI writer isn't connected yet. A system administrator can see what's needed under System → Settings & status.");
    }
    if (this.today.value >= DAILY_LIMIT) {
      throw new HttpException("The AI writer's daily limit has been reached. Try again tomorrow.", HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!dto.brief?.trim() && !dto.facts?.trim() && !dto.current?.trim()) {
      throw new UnprocessableEntityException("Tell the writer what to write — add a short brief, or some facts.");
    }

    const grounding = [dto.brief, dto.facts, dto.current].filter(Boolean).join(" ");
    const { context } = await this.context.forQuestion(grounding.slice(0, 500));
    const kind = WRITER_KINDS[dto.kind];

    try {
      const { text, model } = await this.gemini.generate(
        buildWriterPrompt(context, dto.kind, dto.tone ?? "friendly"),
        [{ role: "user", text: buildWriterRequest(dto) }],
        { maxOutputTokens: kind.maxTokens, temperature: 0.6, timeoutMs: 20_000 }
      );
      this.today.increment();
      const cleaned = cleanWriterOutput(text, dto.maxChars);
      if (!cleaned) throw new UnprocessableEntityException("The writer came back empty — try adding more detail.");
      return { text: cleaned, model };
    } catch (error) {
      if (error instanceof UnprocessableEntityException) throw error;
      if (error instanceof GeminiBlockedError) {
        throw new UnprocessableEntityException("The AI declined to write that. Try rephrasing the brief.");
      }
      if (error instanceof GeminiUnavailableError) this.logger.warn(`Writer unavailable: ${error.message}`);
      throw new HttpException("The AI writer is busy right now. Please try again in a moment.", HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
