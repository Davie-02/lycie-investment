import type { Request } from "express";
import { createCsrfToken, csrfCheckRequired, hasValidCsrfToken, isValidSignedCsrfToken } from "./csrf";

const req = (path: string, cookie?: string) => ({ path, headers: { cookie } }) as unknown as Request;
const withHeader = (token: string | undefined, cookie?: string) =>
  ({ path: "/api/x", headers: { "x-csrf-token": token, cookie } }) as unknown as Request;

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-csrf-specs";
});

describe("csrfCheckRequired", () => {
  it("skips anonymous requests such as public forms, likes and chat", () => {
    expect(csrfCheckRequired(req("/api/contact"))).toBe(false);
    expect(csrfCheckRequired(req("/api/likes"))).toBe(false);
    expect(csrfCheckRequired(req("/api/lycie/chat/stream", "lycie_csrf=abc"))).toBe(false);
  });

  it("requires it whenever a login session cookie is present", () => {
    expect(csrfCheckRequired(req("/api/vehicles", "lycie_admin_session=jwt"))).toBe(true);
    expect(csrfCheckRequired(req("/api/customers/me", "a=b; lycie_customer_session=jwt"))).toBe(true);
  });

  it("always requires it for login, registration, password reset and social sign-in", () => {
    for (const path of [
      "/api/auth/login",
      "/api/auth/login/2fa",
      "/api/customers/login",
      "/api/customers/register",
      "/api/auth/forgot-password",
      "/api/customers/reset-password",
      "/api/customers/social/google",
      "/api/customers/verify-email",
    ]) {
      expect(csrfCheckRequired(req(path))).toBe(true);
    }
  });
});

describe("signed CSRF tokens (work without any cookie)", () => {
  it("accepts a freshly issued token with no cookie present — the phone/Safari case", () => {
    expect(hasValidCsrfToken(withHeader(createCsrfToken()))).toBe(true);
  });

  it("rejects a token whose signature was tampered with", () => {
    const [nonce, expiry] = createCsrfToken().split(".");
    expect(isValidSignedCsrfToken(`${nonce}.${expiry}.${"0".repeat(64)}`)).toBe(false);
  });

  it("rejects a token that was signed under a different secret", () => {
    const token = createCsrfToken();
    process.env.JWT_SECRET = "a-different-secret";
    expect(isValidSignedCsrfToken(token)).toBe(false);
    process.env.JWT_SECRET = "test-secret-for-csrf-specs";
  });

  it("rejects an expired token", () => {
    const longAgo = Date.now() - 3 * 60 * 60 * 1000;
    expect(isValidSignedCsrfToken(createCsrfToken(longAgo))).toBe(false);
  });

  it("rejects missing or garbage headers", () => {
    expect(hasValidCsrfToken(withHeader(undefined))).toBe(false);
    expect(hasValidCsrfToken(withHeader("not-a-token"))).toBe(false);
  });

  it("still accepts the legacy cookie-must-equal-header scheme for pages loaded before the change", () => {
    expect(hasValidCsrfToken(withHeader("legacy123", "lycie_csrf=legacy123"))).toBe(true);
    expect(hasValidCsrfToken(withHeader("legacy123", "lycie_csrf=different"))).toBe(false);
  });
});
