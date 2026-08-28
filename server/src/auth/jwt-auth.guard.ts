import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
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
    const cookies = this.parseCookies(request.headers.cookie);
    const cookieToken = cookies[ADMIN_SESSION_COOKIE] ?? cookies[CUSTOMER_SESSION_COOKIE];
    if (cookieToken) return cookieToken;

    const header = request.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return null;
    }
    return header.slice("Bearer ".length);
  }

  private parseCookies(header: string | undefined): Record<string, string> {
    if (!header) return {};

    return Object.fromEntries(
      header.split(";").flatMap((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [];
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        return [[key, decodeURIComponent(value)]];
      })
    );
  }
}
