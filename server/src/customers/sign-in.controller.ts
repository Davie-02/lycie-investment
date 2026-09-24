/**
 * The website's one sign-in form, for customers AND staff (POST /api/sign-in).
 *
 * The same email may belong to a customer account, a staff account, or both.
 * The password is checked against each (always the same amount of work, so
 * timing reveals nothing) and the account it opens decides where the person
 * goes: staff to the workspace (/admin) with a staff session, customers to
 * their account page. If both accounts share the password, staff wins.
 *
 * System administrator (Owner) accounts are refused here — they may only sign
 * in through the hardened admin portal (/admin/login).
 */
import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { signInContext } from "../auth/auth.controller";
import { SessionService } from "../auth/session.service";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE, clearSessionCookie } from "../auth/session-cookie";
import { lockedMessage } from "../security/lockout";
import { CustomersService } from "./customers.service";
import { LoginCustomerDto } from "./dto/login-customer.dto";

@Controller("sign-in")
export class SignInController {
  constructor(
    private readonly auth: AuthService,
    private readonly customers: CustomersService,
    private readonly sessions: SessionService
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  @HttpCode(200)
  async signIn(@Body() dto: LoginCustomerDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const remember = dto.remember === true;
    const [staff, customer] = await Promise.all([
      this.auth.checkStaffPassword(dto.email, dto.password),
      this.customers.checkPassword(dto.email, dto.password),
    ]);

    if (staff.matches && staff.admin) {
      if (staff.admin.role === "OWNER") {
        throw new UnauthorizedException("This is a system administrator account. Please sign in through the administrator portal.");
      }
      const result = await this.auth.continueSignIn(staff.admin, remember, signInContext(request));
      if (result.kind === "two-factor") return { kind: "two-factor", challenge: result.challenge };
      if (result.kind === "password-change") return { kind: "password-change", challenge: result.challenge, name: result.name };
      // One person, one kind of session in this browser at a time.
      clearSessionCookie(response, CUSTOMER_SESSION_COOKIE);
      this.sessions.attach(response, ADMIN_SESSION_COOKIE, result.session);
      return { kind: "staff", user: result.user, token: result.session.token, expiresAt: result.session.expiresAt };
    }

    if (customer.matches && customer.customer) {
      const user = await this.customers.completePasswordSignIn(customer.customer);
      const session = await this.customers.issueSession(user, remember);
      clearSessionCookie(response, ADMIN_SESSION_COOKIE);
      this.sessions.attach(response, CUSTOMER_SESSION_COOKIE, session);
      return { kind: "customer", user, token: session.token, expiresAt: session.expiresAt };
    }

    // Nothing opened. Count the wrong password against whichever accounts exist.
    const existing = [staff.admin, customer.customer].filter(Boolean);
    if (staff.admin && !staff.locked) await this.auth.recordStaffFailure(staff.admin);
    if (customer.customer && !customer.locked) await this.customers.recordFailure(customer.customer);
    const allLocked = existing.length > 0 && (!staff.admin || staff.locked) && (!customer.customer || customer.locked);
    if (allLocked) {
      const until = staff.admin?.lockedUntil ?? customer.customer?.lockedUntil;
      if (until) throw new UnauthorizedException(lockedMessage(until));
    }
    throw new UnauthorizedException("Invalid email or password.");
  }
}
