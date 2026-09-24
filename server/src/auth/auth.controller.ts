import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService, type LoginResult, type SignInContext } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangeAdminPasswordDto } from "./dto/change-password.dto";
import { DisableTwoFactorDto, TwoFactorCodeDto, TwoFactorLoginDto } from "./dto/two-factor.dto";
import { ConfirmIdentityDto, FirstPasswordDto } from "./dto/first-password.dto";
import { ADMIN_SESSION_COOKIE, clearSessionCookie } from "./session-cookie";
import { createCsrfToken, setCsrfCookie } from "./csrf";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { CurrentUser } from "./current-user.decorator";
import { SessionService, type IssuedSession } from "./session.service";
import { SocialIdentityService } from "./social-identity";
import { checkEmailDeliverable } from "../security/email-check";
import { CheckEmailDto } from "./dto/check-email.dto";

/** What the browser needs from a successful sign-in. `token` lets it fall back to header-based auth if cookies are blocked. */
function sessionBody<T extends object>(user: T, session: IssuedSession) {
  return { user, token: session.token, expiresAt: session.expiresAt };
}

const ADMIN_ROLES = ["OWNER", "MANAGER", "VIEWER", "EMPLOYEE"];

/** Where a sign-in came from, for the alert email. */
export function signInContext(request: Request): SignInContext {
  return { ip: request.ip, userAgent: request.headers["user-agent"]?.slice(0, 300) };
}

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

  /**
   * Live email check for sign-up and contact forms: shape, provider typos,
   * throwaway domains and mail servers (not the paid mailbox check — that runs
   * when an account is actually created). Says nothing about whether an
   * account exists, so it can't be used to discover who is registered.
   */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post("check-email")
  @HttpCode(200)
  async checkEmail(@Body() dto: CheckEmailDto) {
    return checkEmailDeliverable(dto.email);
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
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto.email, dto.password, dto.remember === true, signInContext(request));
    return this.respond(result, response);
  }

  /** Turns a sign-in step's result into the response (setting the staff session cookie when signed in). */
  respond(result: LoginResult, response: Response) {
    if (result.kind === "two-factor") return { requiresTwoFactor: true, challenge: result.challenge };
    if (result.kind === "password-change") return { requiresPasswordChange: true, challenge: result.challenge, name: result.name };
    this.sessions.attach(response, ADMIN_SESSION_COOKIE, result.session);
    return sessionBody(result.user, result.session);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login/2fa")
  @HttpCode(200)
  async loginTwoFactor(@Body() dto: TwoFactorLoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const { session, user } = await this.authService.completeTwoFactorLogin(dto.challenge, dto.code, signInContext(request));
    this.sessions.attach(response, ADMIN_SESSION_COOKIE, session);
    return sessionBody(user, session);
  }

  /** First sign-in with an invitation: choose your own password in place of the one-time one. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("first-password")
  @HttpCode(200)
  async firstPassword(@Body() dto: FirstPasswordDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.completeFirstPassword(dto.challenge, dto.newPassword, signInContext(request));
    return this.respond(result, response);
  }

  /** "Confirm it's you" (password + authenticator code) before sensitive actions; valid for 10 minutes. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("confirm-identity")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  confirmIdentity(@CurrentUser() user: { sub: string }, @Body() dto: ConfirmIdentityDto) {
    return this.authService.confirmIdentity(user.sub, dto.password, dto.code);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    // Cancel the token itself, not just the cookie, so no copy of it keeps working.
    await this.sessions.revokeFromRequest(request, ADMIN_SESSION_COOKIE);
    clearSessionCookie(response, ADMIN_SESSION_COOKIE);
    return { loggedOut: true };
  }

  /** Signs out every other device and browser (lost phone, unrecognised sign-in). This device stays signed in. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("sign-out-everywhere")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  async signOutEverywhere(@CurrentUser() user: { sub: string; remember?: boolean }, @Res({ passthrough: true }) response: Response) {
    const { session, user: current } = await this.authService.signOutEverywhere(user.sub, user.remember === true);
    this.sessions.attach(response, ADMIN_SESSION_COOKIE, session);
    return sessionBody(current, session);
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
