import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { readCookie } from "./cookies";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./session-cookie";
import { SESSION_ROLES, SessionService, type SessionClaims } from "./session.service";

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

    await this.sessions.assertStillValid(payload);

    // Attach the decoded payload so route handlers can read who is calling.
    (request as Request & { user?: unknown }).user = payload;
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
