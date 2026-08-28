import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ADMIN_SESSION_COOKIE, clearSessionCookie, setSessionCookie } from "./session-cookie";
import { createCsrfToken, setCsrfCookie } from "./csrf";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("csrf")
  csrf(@Res({ passthrough: true }) response: Response) {
    const token = createCsrfToken();
    setCsrfCookie(response, token);
    return { token };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto.email, dto.password);
    setSessionCookie(response, ADMIN_SESSION_COOKIE, session.accessToken);
    return { user: session.user };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    clearSessionCookie(response, ADMIN_SESSION_COOKIE);
    return { loggedOut: true };
  }
}
