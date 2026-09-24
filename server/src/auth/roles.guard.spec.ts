import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { effectiveAccess } from "../access/modules";

function makeContext(user: { role: string } | undefined, route = { method: "GET", path: "/api/unknown" }, department: string | null = null, overrides: unknown = null): ExecutionContext {
  const staff = user && user.role !== "CUSTOMER" ? { access: effectiveAccess(user.role, department, overrides), department, totpEnabled: true } : null;
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, staff, method: route.method, path: route.path, baseUrl: "" }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: string[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows any authenticated user through when the route declares no @Roles()", () => {
    expect(makeGuard(undefined).canActivate(makeContext({ role: "CUSTOMER" }))).toBe(true);
  });

  it("falls back to the role list for staff routes the access table doesn't know", () => {
    expect(makeGuard(["OWNER", "MANAGER"]).canActivate(makeContext({ role: "MANAGER" }))).toBe(true);
    expect(() => makeGuard(["OWNER", "MANAGER"]).canActivate(makeContext({ role: "EMPLOYEE" }))).toThrow(ForbiddenException);
  });

  it("rejects a customer token on a staff route", () => {
    expect(() => makeGuard(["OWNER", "MANAGER", "VIEWER"]).canActivate(makeContext({ role: "CUSTOMER" }))).toThrow(ForbiddenException);
  });

  it("rejects staff on a customer-only route", () => {
    expect(() => makeGuard(["CUSTOMER"]).canActivate(makeContext({ role: "OWNER" }))).toThrow(ForbiddenException);
  });

  it("rejects when there is no user on the request at all", () => {
    expect(() => makeGuard(["OWNER"]).canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it("lets the system administrator into every staff route", () => {
    expect(makeGuard(["OWNER", "MANAGER"]).canActivate(makeContext({ role: "OWNER" }, { method: "DELETE", path: "/api/vehicles/x" }))).toBe(true);
  });

  it("decides employees by module access, not role lists", () => {
    const guard = makeGuard(["OWNER", "MANAGER"]);
    const edit = { method: "PATCH", path: "/api/vehicles/x" };
    expect(guard.canActivate(makeContext({ role: "EMPLOYEE" }, edit, "sales"))).toBe(true);
    expect(() => guard.canActivate(makeContext({ role: "EMPLOYEE" }, edit, "hire"))).toThrow(/Sales/);
    // Limited by an override: can look but not change.
    expect(guard.canActivate(makeContext({ role: "EMPLOYEE" }, { method: "GET", path: "/api/vehicles" }, "sales", { sales: "view" }))).toBe(true);
    expect(() => guard.canActivate(makeContext({ role: "EMPLOYEE" }, edit, "sales", { sales: "view" }))).toThrow(ForbiddenException);
    // Extended by an override: a hire employee given finance access.
    expect(guard.canActivate(makeContext({ role: "EMPLOYEE" }, { method: "POST", path: "/api/financial/payments/p/approve" }, "hire", { finance: "edit" }))).toBe(true);
  });

  it("requires manage level for personal-data exports", () => {
    const guard = makeGuard(["OWNER", "MANAGER"]);
    expect(() => guard.canActivate(makeContext({ role: "EMPLOYEE" }, { method: "GET", path: "/api/admin-tools/export/inquiries" }, "sales"))).toThrow(ForbiddenException);
    expect(guard.canActivate(makeContext({ role: "EMPLOYEE" }, { method: "GET", path: "/api/admin-tools/export/inquiries" }, "sales", { sales: "manage" }))).toBe(true);
  });
});
