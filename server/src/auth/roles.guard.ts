import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "./roles.decorator";

interface JwtPayload {
  sub: string;
  role: string;
  name: string;
  email: string;
}

/**
 * Must run after JwtAuthGuard (which attaches req.user) — see the combined
 * usage pattern: @UseGuards(JwtAuthGuard, RolesGuard). If a route has no
 * @Roles() decorator, this guard allows any authenticated user through;
 * it only restricts routes that explicitly declare required roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("You don't have permission to perform this action.");
    }

    return true;
  }
}
