import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { SubmissionsService } from "./submissions.service";
import { SuggestionsService } from "./suggestions.service";
import {
  CreateSubmissionDto,
  EditSuggestionDto,
  SUBMISSION_KINDS,
  SubmissionKind,
  UpdateSubmissionStatusDto,
} from "./dto/submission.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

const STATUSES = ["pending", "published", "rejected"] as const;

@Controller("lycie")
export class SuggestionsController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly suggestions: SuggestionsService
  ) {}

  // ---- public: "Ask us" form on the FAQ page ----

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(201)
  @Post("submissions")
  submit(@Body() dto: CreateSubmissionDto) {
    return this.submissions.create(dto);
  }

  // ---- admin: visitor messages ----

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("submissions")
  listSubmissions(@Query("kind") kind?: string, @Query("status") status?: string) {
    return this.submissions.list(
      SUBMISSION_KINDS.includes(kind as SubmissionKind) ? (kind as SubmissionKind) : undefined,
      status === "new" || status === "handled" ? status : undefined
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch("submissions/:id")
  updateSubmission(@Param("id") id: string, @Body() dto: UpdateSubmissionStatusDto) {
    return this.submissions.setStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @HttpCode(204)
  @Delete("submissions/:id")
  async removeSubmission(@Param("id") id: string) {
    await this.submissions.remove(id);
  }

  // ---- admin: most-asked topics and FAQ drafts ----

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("top-questions")
  topQuestions() {
    return this.suggestions.topTopics();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("suggestions")
  listSuggestions(@Query("status") status?: string) {
    return this.suggestions.list(STATUSES.includes(status as (typeof STATUSES)[number]) ? (status as (typeof STATUSES)[number]) : "pending");
  }

  // Spends AI quota, so tightly throttled. Declared before ":id" routes.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @HttpCode(200)
  @Post("suggestions/generate")
  generate() {
    return this.suggestions.generate();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch("suggestions/:id")
  editSuggestion(@Param("id") id: string, @Body() dto: EditSuggestionDto) {
    return this.suggestions.edit(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @HttpCode(200)
  @Post("suggestions/:id/publish")
  publishSuggestion(@Param("id") id: string, @Body() dto: EditSuggestionDto) {
    return this.suggestions.publish(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @HttpCode(200)
  @Post("suggestions/:id/reject")
  rejectSuggestion(@Param("id") id: string) {
    return this.suggestions.reject(id);
  }
}
