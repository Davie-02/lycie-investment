import { Body, Controller, Get, Post, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
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

  // 5 attempts per minute per IP — tight enough to make password
  // brute-forcing impractical, loose enough that a real admin mistyping
  // their password a couple of times never gets blocked.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  // Same throttle as login — this is a public, unauthenticated endpoint
  // that triggers an email send, so it needs the same brute-force/abuse
  // protection.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
}
