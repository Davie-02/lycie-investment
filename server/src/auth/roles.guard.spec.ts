import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function makeContext(user: { role: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: string[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows any authenticated user through when the route declares no @Roles()", () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext({ role: "CUSTOMER" }))).toBe(true);
  });

  it("allows a user whose role is in the required set", () => {
    const guard = makeGuard(["OWNER", "MANAGER"]);
    expect(guard.canActivate(makeContext({ role: "MANAGER" }))).toBe(true);
  });

  it("rejects a user whose role is not in the required set", () => {
    const guard = makeGuard(["OWNER", "MANAGER"]);
    expect(() => guard.canActivate(makeContext({ role: "VIEWER" }))).toThrow(ForbiddenException);
  });

  // The customer JWT payload always carries role: "CUSTOMER" (see
  // customers.controller.ts) — this confirms it can never satisfy an
  // admin-only route, since AdminRole is strictly OWNER/MANAGER/VIEWER.
  it("rejects a customer token on an admin-only route", () => {
    const guard = makeGuard(["OWNER", "MANAGER", "VIEWER"]);
    expect(() => guard.canActivate(makeContext({ role: "CUSTOMER" }))).toThrow(ForbiddenException);
  });

  it("rejects when there is no user on the request at all", () => {
    const guard = makeGuard(["OWNER"]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
