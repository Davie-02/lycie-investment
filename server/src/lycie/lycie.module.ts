import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LycieController } from "./lycie.controller";
import { LycieService } from "./lycie.service";
import { ContextService } from "./context.service";
import { GeminiClient } from "./gemini.client";
import { LycieLogsCron } from "./lycie-logs.cron";
import { SuggestionsController } from "./suggestions.controller";
import { SubmissionsService } from "./submissions.service";
import { SuggestionsService } from "./suggestions.service";
import { LycieSuggestionsCron } from "./lycie-suggestions.cron";

@Module({
  imports: [AuthModule],
  controllers: [LycieController, SuggestionsController],
  providers: [
    LycieService,
    ContextService,
    GeminiClient,
    LycieLogsCron,
    SubmissionsService,
    SuggestionsService,
    LycieSuggestionsCron,
  ],
})
export class LycieModule {}
