import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AccessMap } from "./modules";

/** Who is calling a staff route: id, role, name and their module access (set by JwtAuthGuard). */
export interface StaffActor {
  sub: string;
  role: string;
  name: string;
  email: string;
  access: AccessMap;
}

export const CurrentStaff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffActor => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: Omit<StaffActor, "access">; staff?: { access: AccessMap } | null }>();
  return { ...(request.user as Omit<StaffActor, "access">), access: request.staff?.access ?? ({} as AccessMap) };
});
