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
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { WriterController } from "./writer.controller";
import { WriterService } from "./writer.service";

@Module({
  imports: [AuthModule],
  controllers: [LycieController, SuggestionsController, DocumentsController, WriterController],
  providers: [
    LycieService,
    ContextService,
    GeminiClient,
    LycieLogsCron,
    SubmissionsService,
    SuggestionsService,
    LycieSuggestionsCron,
    DocumentsService,
    WriterService,
  ],
})
export class LycieModule {}
