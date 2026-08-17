import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

interface JwtPayload {
  sub: string;
  role: string;
  name: string;
  email: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
  return request.user as JwtPayload;
});
