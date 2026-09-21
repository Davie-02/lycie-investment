import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangeAdminPasswordDto } from "./dto/change-password.dto";
import { DisableTwoFactorDto, TwoFactorCodeDto, TwoFactorLoginDto } from "./dto/two-factor.dto";
import { ADMIN_SESSION_COOKIE, clearSessionCookie } from "./session-cookie";
import { createCsrfToken, setCsrfCookie } from "./csrf";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { CurrentUser } from "./current-user.decorator";
import { SessionService, type IssuedSession } from "./session.service";
import { SocialIdentityService } from "./social-identity";

/** What the browser needs from a successful sign-in. `token` lets it fall back to header-based auth if cookies are blocked. */
function sessionBody<T extends object>(user: T, session: IssuedSession) {
  return { user, token: session.token, expiresAt: session.expiresAt };
}

const ADMIN_ROLES = ["OWNER", "MANAGER", "VIEWER"];

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    private readonly social: SocialIdentityService
  ) {}

  /** A fresh anti-forgery token. Signed, so the server needs no cookie to check it later (see csrf.ts). */
  @Get("csrf")
  csrf(@Res({ passthrough: true }) response: Response) {
    const token = createCsrfToken();
    setCsrfCookie(response, token);
    return { token };
  }

  /** Which "Continue with…" providers are configured, so the browser only draws buttons that will work. */
  @Get("providers")
  providers() {
    return this.social.providers();
  }

  // 5 attempts per minute per IP — tight enough to make password
  // brute-forcing impractical, loose enough that a real admin mistyping
  // their password a couple of times never gets blocked. (Per-account
  // lockout in AuthService.login covers attacks spread over many IPs.)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto.email, dto.password, dto.remember === true);
    if (result.kind === "two-factor") {
      // No session yet — the browser must come back with the authenticator code.
      return { requiresTwoFactor: true, challenge: result.challenge };
    }

    this.sessions.attach(response, ADMIN_SESSION_COOKIE, result.session);
    return sessionBody(result.user, result.session);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login/2fa")
  @HttpCode(200)
  async loginTwoFactor(@Body() dto: TwoFactorLoginDto, @Res({ passthrough: true }) response: Response) {
    const { session, user } = await this.authService.completeTwoFactorLogin(dto.challenge, dto.code);
    this.sessions.attach(response, ADMIN_SESSION_COOKIE, session);
    return sessionBody(user, session);
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    clearSessionCookie(response, ADMIN_SESSION_COOKIE);
    return { loggedOut: true };
  }

  /** "Am I signed in, and as whom?" Also how the browser proves its session cookie really works. */
  @Get("session")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  session(@CurrentUser() user: { sub: string }) {
    return this.authService.getSession(user.sub);
  }

  // Same throttle as login — this is a public, unauthenticated endpoint
  // that triggers an email send, so it needs the same brute-force/abuse
  // protection.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  /** An admin changing their own password; returns a fresh session so this device stays signed in. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("change-password")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  async changePassword(
    @CurrentUser() user: { sub: string; remember?: boolean },
    @Body() dto: ChangeAdminPasswordDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const { session, user: updated } = await this.authService.changePassword(user.sub, dto.currentPassword, dto.newPassword, user.remember === true);
    this.sessions.attach(response, ADMIN_SESSION_COOKIE, session);
    return sessionBody(updated, session);
  }

  // ----- Two-factor management (all require being signed in) -----

  @Post("2fa/setup")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  twoFactorSetup(@CurrentUser() user: { sub: string }) {
    return this.authService.beginTwoFactorSetup(user.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("2fa/enable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  twoFactorEnable(@CurrentUser() user: { sub: string }, @Body() dto: TwoFactorCodeDto) {
    return this.authService.enableTwoFactor(user.sub, dto.code);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("2fa/disable")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  twoFactorDisable(@CurrentUser() user: { sub: string }, @Body() dto: DisableTwoFactorDto) {
    return this.authService.disableTwoFactor(user.sub, dto.password, dto.code);
  }
}
