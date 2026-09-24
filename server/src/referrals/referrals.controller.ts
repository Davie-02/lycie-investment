import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ADMIN_ROLES } from "../auth/session.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ReferralsService } from "./referrals.service";

class RewardDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

class DeclineDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

@Controller("customers/me/referral")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class MyReferralController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  mine(@CurrentUser() user: { sub: string }) {
    return this.referrals.mine(user.sub);
  }
}

/** Finance module (see access/route-access.ts). */
@Controller("referrals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class ReferralsAdminController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  list() {
    return this.referrals.list();
  }

  @Get("summary")
  summary() {
    return this.referrals.summary();
  }

  @Post(":id/reward")
  @HttpCode(200)
  reward(@Param("id") id: string, @Body() dto: RewardDto) {
    return this.referrals.reward(id, dto.amount, dto.note);
  }

  @Post(":id/decline")
  @HttpCode(200)
  decline(@Param("id") id: string, @Body() dto: DeclineDto) {
    return this.referrals.decline(id, dto.note);
  }
}
