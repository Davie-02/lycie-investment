import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { LycieService } from "./lycie.service";
import { ChatDto, FeedbackDto } from "./dto/chat.dto";
import { CreateKnowledgeDto, UpdateKnowledgeDto } from "./dto/knowledge.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("lycie")
export class LycieController {
  constructor(private readonly lycie: LycieService) {}

  // Lets the widget hide itself when no API key is configured.
  @Get("status")
  status() {
    return { enabled: this.lycie.isEnabled };
  }

  // Public and read-only. Throttled hard: every call spends free-tier AI quota.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post("chat")
  chat(@Body() dto: ChatDto, @Req() request: Request) {
    return this.lycie.chat(dto, request.ip ?? "unknown");
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post("feedback")
  async feedback(@Body() dto: FeedbackDto) {
    await this.lycie.feedback(dto.logId, dto.helpful);
    return { recorded: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("knowledge")
  listKnowledge() {
    return this.lycie.listKnowledge();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Post("knowledge")
  createKnowledge(@Body() dto: CreateKnowledgeDto) {
    return this.lycie.createKnowledge(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch("knowledge/:id")
  updateKnowledge(@Param("id") id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.lycie.updateKnowledge(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @HttpCode(204)
  @Delete("knowledge/:id")
  async removeKnowledge(@Param("id") id: string) {
    await this.lycie.removeKnowledge(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("analytics")
  analytics(@Query("days") days?: string) {
    const parsed = Number(days);
    return this.lycie.analytics(Number.isFinite(parsed) ? Math.min(90, Math.max(1, Math.floor(parsed))) : 30);
  }
}
