import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { CustomersService } from "./customers.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { LoginCustomerDto } from "./dto/login-customer.dto";
import { UpdateCustomerProfileDto } from "./dto/update-customer-profile.dto";
import { ChangeCustomerPasswordDto } from "./dto/change-customer-password.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { FacebookLoginDto, GoogleLoginDto, VerifyEmailDto } from "./dto/social-login.dto";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { CUSTOMER_SESSION_COOKIE, clearSessionCookie } from "../auth/session-cookie";
import { SessionService, type IssuedSession } from "../auth/session.service";
import { SocialIdentityService } from "../auth/social-identity";

/** What the browser needs from a successful sign-in. `token` lets it fall back to header-based auth if cookies are blocked. */
function sessionBody<T extends object>(user: T, session: IssuedSession) {
  return { user, token: session.token, expiresAt: session.expiresAt };
}

@Controller("customers")
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly sessions: SessionService,
    private readonly social: SocialIdentityService
  ) {}

  // Same reasoning as admin login's throttle — see auth.controller.ts.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("register")
  async register(@Body() dto: RegisterCustomerDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.customers.register(dto);
    return this.createSession(user, dto.remember === true, response);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginCustomerDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.customers.authenticate(dto.email, dto.password);
    return this.createSession(user, dto.remember === true, response);
  }

  /** "Continue with Google": verifies Google's signed proof, then signs in or creates the account. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("social/google")
  @HttpCode(200)
  async googleLogin(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) response: Response) {
    const identity = await this.social.verifyGoogle(dto.credential);
    const user = await this.customers.signInWithIdentity(identity);
    return this.createSession(user, dto.remember === true, response);
  }

  /** "Continue with Facebook": same idea, verified against Facebook's servers. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("social/facebook")
  @HttpCode(200)
  async facebookLogin(@Body() dto: FacebookLoginDto, @Res({ passthrough: true }) response: Response) {
    const identity = await this.social.verifyFacebook(dto.accessToken);
    const user = await this.customers.signInWithIdentity(identity);
    return this.createSession(user, dto.remember === true, response);
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    clearSessionCookie(response, CUSTOMER_SESSION_COOKIE);
    return { loggedOut: true };
  }

  /** "Am I signed in?" — the browser calls this after login to confirm its cookie actually works. */
  @Get("session")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  session(@CurrentUser() user: { sub: string }) {
    return this.customers.getSession(user.sub);
  }

  /** Consumes the link in the "confirm your email" message. */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("verify-email")
  @HttpCode(200)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.customers.verifyEmail(dto.token);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post("me/resend-verification")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  resendVerification(@CurrentUser() user: { sub: string }) {
    return this.customers.resendVerification(user.sub);
  }

  // Same throttle as register/login — this is a public, unauthenticated
  // endpoint that triggers an email send, so it needs the same brute-force/
  // abuse protection.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("forgot-password")
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.customers.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("reset-password")
  @HttpCode(200)
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
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  async changePassword(
    @CurrentUser() user: { sub: string; remember?: boolean },
    @Body() dto: ChangeCustomerPasswordDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const { session, user: updated } = await this.customers.changePassword(user.sub, dto, user.remember === true);
    // Other devices were just signed out; give this one a fresh session.
    this.sessions.attach(response, CUSTOMER_SESSION_COOKIE, session);
    return { ...sessionBody(updated, session), updated: true };
  }

  @Get("me/saved-vehicles")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  savedVehicles(@CurrentUser() user: { sub: string }) {
    return this.customers.findSavedVehicles(user.sub);
  }

  @Post("me/saved-vehicles/:vehicleId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  saveVehicle(@CurrentUser() user: { sub: string }, @Param("vehicleId") vehicleId: string) {
    return this.customers.saveVehicle(user.sub, vehicleId);
  }

  @Delete("me/saved-vehicles/:vehicleId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  unsaveVehicle(@CurrentUser() user: { sub: string }, @Param("vehicleId") vehicleId: string) {
    return this.customers.unsaveVehicle(user.sub, vehicleId);
  }

  /** Mints the session, sets the cookie, and returns the user + token (for the cookie-free fallback). */
  private async createSession(
    user: { id: string; name: string; email: string; emailVerifiedAt?: Date | null },
    remember: boolean,
    response: Response
  ) {
    const session = await this.customers.issueSession(user, remember);
    this.sessions.attach(response, CUSTOMER_SESSION_COOKIE, session);
    return sessionBody(
      { id: user.id, name: user.name, email: user.email, emailVerifiedAt: user.emailVerifiedAt ?? null },
      session
    );
  }
}
