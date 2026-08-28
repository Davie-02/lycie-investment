import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtService } from "@nestjs/jwt";
import { CustomersService } from "./customers.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { LoginCustomerDto } from "./dto/login-customer.dto";
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

  @Post("register")
  async register(@Body() dto: RegisterCustomerDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.customers.register(dto);
    return this.createSession(user, response);
  }

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

  @Get("me/cases")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  cases(@CurrentUser() user: { sub: string }) {
    return this.customers.findCases(user.sub);
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