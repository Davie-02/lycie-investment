import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./session-cookie";

function makeContext(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeGuard(verifyAsync: (token: string) => Promise<unknown>): JwtAuthGuard {
  const jwtService = { verifyAsync } as unknown as JwtService;
  return new JwtAuthGuard(jwtService);
}

describe("JwtAuthGuard", () => {
  it("throws when no token is present anywhere", async () => {
    const guard = makeGuard(async () => ({ sub: "1" }));
    await expect(guard.canActivate(makeContext({ headers: {} }))).rejects.toThrow(UnauthorizedException);
  });

  it("reads the token from the admin session cookie", async () => {
    let receivedToken: string | undefined;
    const guard = makeGuard(async (token) => {
      receivedToken = token;
      return { sub: "admin-1", role: "OWNER" };
    });

    const request = { headers: { cookie: `${ADMIN_SESSION_COOKIE}=admin-token-value` } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(receivedToken).toBe("admin-token-value");
  });

  it("reads the token from the customer session cookie", async () => {
    let receivedToken: string | undefined;
    const guard = makeGuard(async (token) => {
      receivedToken = token;
      return { sub: "cust-1", role: "CUSTOMER" };
    });

    const request = { headers: { cookie: `${CUSTOMER_SESSION_COOKIE}=customer-token-value` } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(receivedToken).toBe("customer-token-value");
  });

  it("falls back to a Bearer authorization header when there's no cookie", async () => {
    let receivedToken: string | undefined;
    const guard = makeGuard(async (token) => {
      receivedToken = token;
      return { sub: "api-client" };
    });

    const request = { headers: { authorization: "Bearer header-token-value" } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(receivedToken).toBe("header-token-value");
  });

  it("throws when the token is invalid or expired", async () => {
    const guard = makeGuard(async () => {
      throw new Error("jwt expired");
    });

    const request = { headers: { cookie: `${ADMIN_SESSION_COOKIE}=stale-token` } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
  });
});
