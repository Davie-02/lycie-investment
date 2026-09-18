import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { readCookie } from "./cookies";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./session-cookie";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing authentication token.");
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      // Attach the decoded payload in case a route handler wants it later.
      (request as Request & { user?: unknown }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired authentication token.");
    }
  }

  private extractToken(request: Request): string | null {
    const cookieToken =
      readCookie(request.headers.cookie, ADMIN_SESSION_COOKIE) ??
      readCookie(request.headers.cookie, CUSTOMER_SESSION_COOKIE);
    if (cookieToken) return cookieToken;

    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return null;
    }
    return header.slice("Bearer ".length);
  }
}
