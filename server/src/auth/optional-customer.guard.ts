import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { readCookie } from "./cookies";
import { CUSTOMER_SESSION_COOKIE } from "./session-cookie";
import { SessionService, type SessionClaims } from "./session.service";

interface CustomerJwtPayload {
  sub: string;
  role: string;
}

/**
 * For public endpoints (vehicle inquiries, hire/import/clearing requests,
 * contact messages) that should still record *which* customer submitted
 * them when they happen to be logged in, without requiring login. Always
 * lets the request through — it only attaches `request.customerId` when a
 * valid customer session (cookie, or Bearer header in cookie-free mode) is
 * present, and silently treats a missing, invalid, or expired one as
 * "anonymous" rather than rejecting the request.
 */
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: SessionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { customerId?: string }>();
    const bearer = request.headers.authorization;
    const token = bearer?.startsWith("Bearer ")
      ? bearer.slice("Bearer ".length)
      : readCookie(request.headers.cookie, CUSTOMER_SESSION_COOKIE);
    if (!token) return true;

    try {
      const payload = await this.jwtService.verifyAsync<CustomerJwtPayload>(token);
      if (payload.role === "CUSTOMER" && typeof payload.sub === "string") {
        // A signed-out, deactivated or password-reset session doesn't count either.
        await this.sessions.assertStillValid(payload as SessionClaims);
        request.customerId = payload.sub;
      }
    } catch {
      // Expired/invalid/tampered/revoked token — treat the same as not logged in.
    }

    return true;
  }
}
