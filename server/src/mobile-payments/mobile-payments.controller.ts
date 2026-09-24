import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { MobilePaymentsService } from "./mobile-payments.service";
import { StartMobilePaymentDto } from "./mobile-payments.dto";

/** Customers paying by mobile money, and the gateway's webhook. */
@Controller("payments/mobile")
export class CustomerMobilePaymentsController {
  constructor(private readonly payments: MobilePaymentsService) {}

  /** Public: whether to show the "Pay with mobile money" option. */
  @Get("status")
  status() {
    return { enabled: this.payments.enabled };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  start(@CurrentUser() user: { sub: string }, @Body() dto: StartMobilePaymentDto) {
    return this.payments.start(user.sub, dto);
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  mine(@CurrentUser() user: { sub: string }) {
    return this.payments.mine(user.sub);
  }

  /** The return page asks this; the server checks with the gateway before believing anything. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(":txRef/confirm")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  confirm(@CurrentUser() user: { sub: string }, @Param("txRef") txRef: string) {
    return this.payments.confirm(txRef.slice(0, 64), user.sub);
  }
}

/** PayChangu calls this after a payment; the signature is checked and the payment re-verified. */
@Controller("mobile-payments/webhook")
@SkipThrottle()
export class MobilePaymentsWebhookController {
  constructor(private readonly payments: MobilePaymentsService) {}

  @Post()
  @HttpCode(200)
  webhook(@Req() request: RawBodyRequest<Request>, @Headers("signature") signature: string | undefined, @Body() body: Record<string, unknown>) {
    return this.payments.handleWebhook(request.rawBody, signature, body ?? {});
  }
}

/** Finance: every mobile-money attempt, and a re-check button for pending ones. */
@Controller("mobile-payments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class MobilePaymentsAdminController {
  constructor(private readonly payments: MobilePaymentsService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.payments.list(status && ["pending", "success", "failed"].includes(status) ? status : undefined);
  }

  @Get("summary")
  summary() {
    return this.payments.summary();
  }

  @Post(":txRef/recheck")
  @HttpCode(200)
  recheck(@Param("txRef") txRef: string) {
    return this.payments.confirm(txRef.slice(0, 64));
  }
}
