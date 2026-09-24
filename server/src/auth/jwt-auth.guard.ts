import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { readCookie } from "./cookies";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./session-cookie";
import { SESSION_ROLES, SessionService, type SessionClaims } from "./session.service";
import { allowedBeforeTwoFactorSetup, ownerIpAllowed, ownerTwoFactorRequired } from "../access/system-admin-policy";

/**
 * Lets a request through only if it carries a genuine, current sign-in.
 * Put it before RolesGuard: @UseGuards(JwtAuthGuard, RolesGuard).
 *
 * "Genuine" means the token's signature checks out and it hasn't expired.
 * "Current" means the account still exists and is active, and its password
 * hasn't been changed since (SessionService.assertStillValid).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: SessionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing authentication token.");
    }

    let payload: SessionClaims;
    try {
      payload = await this.jwtService.verifyAsync<SessionClaims>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired authentication token.");
    }

    // Tokens with any other role (notably the "password ok, 2FA still needed"
    // challenge) prove nothing about being signed in and must never open a route.
    if (!(SESSION_ROLES as readonly string[]).includes(payload.role)) {
      throw new UnauthorizedException("Invalid authentication token.");
    }

    const staff = await this.sessions.assertStillValid(payload);

    if (payload.role === "OWNER") {
      if (!ownerIpAllowed(request.ip)) {
        throw new ForbiddenException("System administrator accounts can't be used from this network.");
      }
      if (ownerTwoFactorRequired() && staff && !staff.totpEnabled && !allowedBeforeTwoFactorSetup(request.path)) {
        throw new ForbiddenException({
          statusCode: 403,
          code: "TWO_FACTOR_SETUP_REQUIRED",
          message: "System administrators must turn on two-step verification before continuing. Open My Security to set it up.",
        });
      }
    }

    // Attach the decoded payload (and, for staff, their module access) so guards and handlers can read who is calling.
    (request as Request & { user?: unknown; staff?: unknown }).user = payload;
    (request as Request & { staff?: unknown }).staff = staff;
    return true;
  }

  /**
   * Where the token comes from, in priority order:
   *  1. `Authorization: Bearer …` — explicit, used by the cookie-free fallback;
   *  2. the admin cookie, then 3. the customer cookie.
   * The header wins so a stale cookie left in the browser can't override a
   * deliberate choice of session.
   */
  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);

    return (
      readCookie(request.headers.cookie, ADMIN_SESSION_COOKIE) ??
      readCookie(request.headers.cookie, CUSTOMER_SESSION_COOKIE) ??
      null
    );
  }
}
