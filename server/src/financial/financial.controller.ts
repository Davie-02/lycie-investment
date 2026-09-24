/**
 * Money endpoints. Customers see their own account and submit proof of payment; only
 * Owner/Manager can list payments and approve or reject them. Who 'me' is always comes
 * from the verified sign-in, never from the request.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { memoryStorage } from "multer";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CreateFinancialTransactionDto } from "./dto/create-financial-transaction.dto";
import { FinancialService } from "./financial.service";

@Controller("financial")
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get("me")
  @Roles("CUSTOMER")
  history(
    @CurrentUser() user: { sub: string },
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string
  ) {
    return this.financial.findHistory(user.sub, Number(page ?? 1), Number(pageSize ?? 25));
  }

  @Post("me/payment-submissions")
  @Roles("CUSTOMER")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor("proof", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    })
  )
  submitPayment(
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateFinancialTransactionDto
  ) {
    if (!file) {
      throw new BadRequestException("Proof of payment is required.");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException("Proof must be a JPEG, PNG, or WebP image.");
    }
    return this.financial.submitPayment(user.sub, file, dto);
  }

  @Get("payments")
  @Roles("OWNER", "MANAGER")
  listPayments(@Query("status") status?: "PENDING" | "APPROVED" | "REJECTED") {
    return this.financial.listPayments(status);
  }

  @Post("payments/:id/approve")
  @Roles("OWNER", "MANAGER")
  approvePayment(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string; name?: string },
    @Body("note") note?: string,
    @Body("creditAmount") creditAmount?: unknown,
    @Body("receivedAmount") receivedAmount?: unknown
  ) {
    const money = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) && n > 0 && n < 1e11 ? Math.round(n * 100) / 100 : undefined;
    };
    return this.financial.reviewPayment(id, user, true, typeof note === "string" ? note.slice(0, 500) : undefined, money(creditAmount), money(receivedAmount));
  }

  @Post("payments/:id/reject")
  @Roles("OWNER", "MANAGER")
  rejectPayment(
    @Param("id") id: string,
    @CurrentUser() user: { sub: string },
    @Body("note") note?: string
  ) {
    return this.financial.reviewPayment(id, user, false, typeof note === "string" ? note.slice(0, 500) : undefined);
  }
}