/**
 * Wires the Lycie assistant together: chat, knowledge notes, uploaded documents, FAQ
 * suggestions, testimonial ideas, the AI writing helper, the Gemini client and the
 * scheduled clean-up/suggestion jobs.
 */
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricingModule } from "../pricing/pricing.module";
import { LycieController } from "./lycie.controller";
import { LycieService } from "./lycie.service";
import { ContextService } from "./context.service";
import { GeminiModule } from "./gemini.module";
import { LycieLogsCron } from "./lycie-logs.cron";
import { SuggestionsController } from "./suggestions.controller";
import { SubmissionsService } from "./submissions.service";
import { SuggestionsService } from "./suggestions.service";
import { LycieSuggestionsCron } from "./lycie-suggestions.cron";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { WriterController } from "./writer.controller";
import { WriterService } from "./writer.service";
import { TestimonialIdeasService } from "./testimonial-ideas.service";

@Module({
  imports: [AuthModule, PricingModule, GeminiModule],
  controllers: [LycieController, SuggestionsController, DocumentsController, WriterController],
  providers: [
    LycieService,
    ContextService,
    LycieLogsCron,
    SubmissionsService,
    SuggestionsService,
    LycieSuggestionsCron,
    DocumentsService,
    WriterService,
    TestimonialIdeasService,
  ],
})
export class LycieModule {}
