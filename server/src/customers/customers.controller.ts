import { Body, Controller, Get, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { JwtService } from "@nestjs/jwt";
import { CustomersService } from "./customers.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { LoginCustomerDto } from "./dto/login-customer.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";
import { ChangeCustomerPasswordDto } from "./dto/change-customer-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CUSTOMER_SESSION_COOKIE, clearSessionCookie, setSessionCookie } from "../auth/session-cookie";

@Controller("customers")
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly jwt: JwtService
  ) {}

  // Same reasoning as admin login's throttle — see auth.controller.ts.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  async register(@Body() dto: RegisterCustomerDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.customers.register(dto);
    return this.createSession(user, response);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  async login(@Body() dto: LoginCustomerDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.customers.authenticate(dto.email, dto.password);
    return this.createSession(user, response);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    clearSessionCookie(response, CUSTOMER_SESSION_COOKIE);
    return { loggedOut: true };
  }

  // Same throttle as register/login — this is a public, unauthenticated
  // endpoint that triggers an email send, so it needs the same brute-force/
  // abuse protection.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.customers.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.customers.resetPassword(dto.token, dto.newPassword);
  }

  @Get("me/cases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  cases(@CurrentUser() user: { sub: string }) {
    return this.customers.findCases(user.sub);
  }

  @Get("me/requests")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  myRequests(@CurrentUser() user: { sub: string }) {
    return this.customers.findMyRequests(user.sub);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  updateProfile(@CurrentUser() user: { sub: string }, @Body() dto: UpdateCustomerProfileDto) {
    return this.customers.updateProfile(user.sub, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("me/change-password")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  changePassword(@CurrentUser() user: { sub: string }, @Body() dto: ChangeCustomerPasswordDto) {
    return this.customers.changePassword(user.sub, dto);
  }

  private async createSession(user: { id: string; name: string; email: string }, response: Response) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: "CUSTOMER",
      name: user.name,
      email: user.email,
    });

    setSessionCookie(response, CUSTOMER_SESSION_COOKIE, accessToken);
    return { user };
  }
}