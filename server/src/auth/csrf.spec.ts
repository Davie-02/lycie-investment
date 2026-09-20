import type { Request } from "express";
import { csrfCheckRequired } from "./csrf";

const req = (path: string, cookie?: string) => ({ path, headers: { cookie } }) as unknown as Request;

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

  it("always requires it for login, registration and password reset", () => {
    for (const path of ["/api/auth/login", "/api/customers/login", "/api/customers/register", "/api/auth/forgot-password", "/api/customers/reset-password"]) {
      expect(csrfCheckRequired(req(path))).toBe(true);
    }
  });
});
