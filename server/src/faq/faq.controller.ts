import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { FaqService } from "./faq.service";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("faq")
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.faqService.findAll(this.parseNumber(page, 1), this.parsePageSize(pageSize, 100));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Post()
  create(@Body() dto: CreateFaqDto) {
    return this.faqService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFaqDto) {
    return this.faqService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.faqService.remove(id);
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
  }

  private parsePageSize(value: string | undefined, fallback: number): number {
    return Math.min(100, this.parseNumber(value, fallback));
  }
}
