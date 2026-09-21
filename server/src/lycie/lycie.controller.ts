import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
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
  /** Admin: tests every AI model right now from the live server and reports which work and how fast. */
  @Throttle({ default: { limit: 4, ttl: 60000 } })
  @Post("diagnose")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  async diagnose() {
    return { settings: this.lycie.aiSettings, results: await this.lycie.diagnose() };
  }

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

  // Same as /chat, but the answer arrives word by word as newline-delimited JSON:
  //   {"type":"delta","text":"…"}  …repeated…  then {"type":"done", reply, vehicles, outcome, logId}
  // Validation/throttle errors happen before streaming starts and are ordinary JSON errors.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("chat/stream")
  async chatStream(@Body() dto: ChatDto, @Req() request: Request, @Res() response: Response): Promise<void> {
    response.status(200);
    response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();

    const write = (payload: object) => {
      if (!response.writableEnded && !response.destroyed) response.write(`${JSON.stringify(payload)}\n`);
    };
    try {
      const result = await this.lycie.chat(dto, request.ip ?? "unknown", (text) => write({ type: "delta", text }));
      write({ type: "done", ...result });
    } catch {
      write({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      response.end();
    }
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
