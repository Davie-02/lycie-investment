import { Body, Controller, ForbiddenException, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentStaff, type StaffActor } from "../access/current-staff.decorator";
import { atLeast } from "../access/modules";
import { PurchasesService } from "./purchases.service";
import { ApplyBalanceDto, CreatePurchaseDto, PurchaseListQuery, ReasonDto, RecordPaymentDto, UpdatePurchaseDto } from "./purchases.dto";

/** A customer's own purchases, balances and payments. */
@Controller("customers/me/purchases")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class MyPurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  mine(@CurrentUser() user: { sub: string }) {
    return this.purchases.mine(user.sub);
  }

  @Get(":id")
  one(@CurrentUser() user: { sub: string }, @Param("id", ParseUUIDPipe) id: string) {
    return this.purchases.mineOne(user.sub, id);
  }

  /** Pay part of a purchase from their own account balance (today's exchange rate). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":id/apply-balance")
  @HttpCode(200)
  applyBalance(@CurrentUser() user: { sub: string }, @Param("id", ParseUUIDPipe) id: string, @Body() dto: ApplyBalanceDto) {
    return this.purchases.applyBalance(id, { amount: dto.amount }, { customerId: user.sub });
  }
}

/**
 * Finance: purchases, payments and customer statements. Access per route is
 * decided in access/route-access.ts (viewing, recording payments, and the
 * sensitive voids/refunds/exports each need a different level).
 */
@Controller("purchases")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class PurchasesAdminController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@Query() query: PurchaseListQuery) {
    return this.purchases.list(query);
  }

  @Get("summary")
  summary(@Query() query: PurchaseListQuery) {
    return this.purchases.summary(query);
  }

  @Get("recent-payments")
  recentPayments() {
    return this.purchases.recentPayments();
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  @Get("export")
  async export(@Query() query: PurchaseListQuery, @Res() response: Response) {
    const csv = await this.purchases.exportCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="purchases-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send("﻿" + csv); // BOM so Excel reads UTF-8 names correctly
  }

  @Get("rate")
  async rate(@Query("from") from = "USD", @Query("to") to = "MWK") {
    const rate = await this.purchases.autoRate(from.slice(0, 3).toUpperCase(), to.slice(0, 3).toUpperCase());
    return { rate: rate ? rate.toFixed(6) : null };
  }

  @Get("options")
  options(@Query("customerId") customerId?: string) {
    return this.purchases.formOptions(customerId && /^[0-9a-f-]{36}$/i.test(customerId) ? customerId : undefined);
  }

  @Get("customers")
  customers(@Query("q") q = "", @Query("all") all?: string) {
    return this.purchases.customerAccounts(q.slice(0, 80), all === "1");
  }

  @Get("customers/:customerId")
  statement(@Param("customerId", ParseUUIDPipe) customerId: string) {
    return this.purchases.statement(customerId);
  }

  @Get("customers/:customerId/open")
  openForCustomer(@Param("customerId", ParseUUIDPipe) customerId: string) {
    return this.purchases.openForCustomer(customerId);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.purchases.get(id);
  }

  @Post()
  create(@Body() dto: CreatePurchaseDto, @CurrentStaff() actor: StaffActor) {
    return this.purchases.create(dto, actor);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePurchaseDto) {
    return this.purchases.update(id, dto);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ReasonDto) {
    return this.purchases.cancel(id, dto.reason);
  }

  @Post(":id/reopen")
  @HttpCode(200)
  reopen(@Param("id", ParseUUIDPipe) id: string) {
    return this.purchases.reopen(id);
  }

  @Post(":id/payments")
  recordPayment(@Param("id", ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto, @CurrentStaff() actor: StaffActor) {
    // Giving money back is as sensitive as voiding a payment (see route-access.ts).
    if (dto.kind === "refund" && actor.role !== "OWNER" && !atLeast(actor.access.finance, "manage")) {
      throw new ForbiddenException("You need manage access to Finance to record a refund. Ask your system administrator.");
    }
    return this.purchases.recordPayment(id, dto, actor);
  }

  @Post(":id/apply-balance")
  @HttpCode(200)
  applyBalance(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ApplyBalanceDto, @CurrentStaff() actor: StaffActor) {
    return this.purchases.applyBalance(id, dto, { actor });
  }

  @Post("payments/:paymentId/void")
  @HttpCode(200)
  voidPayment(@Param("paymentId", ParseUUIDPipe) paymentId: string, @Body() dto: ReasonDto, @CurrentStaff() actor: StaffActor) {
    return this.purchases.voidPayment(paymentId, dto.reason, actor);
  }
}
