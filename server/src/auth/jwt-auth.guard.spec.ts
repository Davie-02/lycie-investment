import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { SessionService } from "./session.service";
import { ADMIN_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE } from "./session-cookie";

function makeContext(request: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** Builds a guard whose token verification and "is this account still valid?" check are both stubbed. */
function makeGuard(
  verifyAsync: (token: string) => Promise<unknown>,
  assertStillValid: (claims: unknown) => Promise<void> = async () => undefined
): JwtAuthGuard {
  const jwtService = { verifyAsync } as unknown as JwtService;
  const sessions = { assertStillValid } as unknown as SessionService;
  return new JwtAuthGuard(jwtService, sessions);
}

describe("JwtAuthGuard", () => {
  it("throws when no token is present anywhere", async () => {
    const guard = makeGuard(async () => ({ sub: "1", role: "OWNER" }));
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

  it("accepts a Bearer authorization header when there's no cookie (cookie-free fallback)", async () => {
    let receivedToken: string | undefined;
    const guard = makeGuard(async (token) => {
      receivedToken = token;
      return { sub: "cust-9", role: "CUSTOMER" };
    });

    const request = { headers: { authorization: "Bearer header-token-value" } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(receivedToken).toBe("header-token-value");
  });

  it("prefers the Bearer header over a stale cookie", async () => {
    let receivedToken: string | undefined;
    const guard = makeGuard(async (token) => {
      receivedToken = token;
      return { sub: "1", role: "OWNER" };
    });

    const request = {
      headers: { authorization: "Bearer fresh", cookie: `${ADMIN_SESSION_COOKIE}=stale` },
    } as Partial<Request>;
    await guard.canActivate(makeContext(request));
    expect(receivedToken).toBe("fresh");
  });

  it("throws when the token is invalid or expired", async () => {
    const guard = makeGuard(async () => {
      throw new Error("jwt expired");
    });

    const request = { headers: { cookie: `${ADMIN_SESSION_COOKIE}=stale-token` } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it("refuses the half-finished two-factor token — it must never work as a login", async () => {
    const guard = makeGuard(async () => ({ sub: "admin-1", role: "2FA_PENDING" }));
    const request = { headers: { authorization: "Bearer challenge" } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it("refuses a valid token whose account has been deactivated or had its password changed", async () => {
    const guard = makeGuard(
      async () => ({ sub: "admin-1", role: "MANAGER" }),
      async () => {
        throw new UnauthorizedException("This account is no longer active.");
      }
    );
    const request = { headers: { authorization: "Bearer ok-signature" } } as Partial<Request>;
    await expect(guard.canActivate(makeContext(request))).rejects.toThrow("no longer active");
  });
});
