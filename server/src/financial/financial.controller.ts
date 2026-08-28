import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateFinancialTransactionDto } from "./dto/create-financial-transaction.dto";
import { FinancialService } from "./financial.service";

@Controller("financial")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get("me")
  history(@CurrentUser() user: { sub: string }, @Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.financial.findHistory(user.sub, Number(page ?? 1), Number(pageSize ?? 25));
  }

  @Post("me/deposits")
  deposit(@CurrentUser() user: { sub: string }, @Body() dto: CreateFinancialTransactionDto) {
    return this.financial.create(user.sub, "DEPOSIT", dto);
  }

  @Post("me/withdrawals")
  withdrawal(@CurrentUser() user: { sub: string }, @Body() dto: CreateFinancialTransactionDto) {
    return this.financial.create(user.sub, "WITHDRAWAL", dto);
  }
}