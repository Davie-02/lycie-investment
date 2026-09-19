import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GeminiClient } from "./gemini.client";
import { SuggestionsService } from "./suggestions.service";

@Injectable()
export class LycieSuggestionsCron {
  private readonly logger = new Logger(LycieSuggestionsCron.name);

  constructor(
    private readonly suggestions: SuggestionsService,
    private readonly gemini: GeminiClient
  ) {}

  // Every Monday morning Lycie reviews the past month's questions and drafts
  // FAQ entries for popular unanswered topics (max 5 AI calls). Drafts wait
  // in the admin for approval. Disable with LYCIE_AUTO_SUGGEST=false.
  @Cron("0 6 * * 1")
  async weeklyAnalysis(): Promise<void> {
    if (process.env.LYCIE_AUTO_SUGGEST === "false" || !this.gemini.isConfigured) return;
    try {
      const result = await this.suggestions.generate();
      this.logger.log(`Weekly FAQ analysis: ${result.created} new draft(s), ${result.updated} refreshed.`);
    } catch (error) {
      this.logger.warn(`Weekly FAQ analysis failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
