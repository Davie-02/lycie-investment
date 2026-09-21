import { promises as dns } from "dns";
import { checkEmailDeliverable, isDisposableEmail, normalizeEmail } from "./email-check";

describe("email-check", () => {
  afterEach(() => jest.restoreAllMocks());

  it("normalises case and whitespace", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });

  it("flags disposable inbox providers", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@gmail.com")).toBe(false);
  });

  it("accepts a domain that has mail servers", async () => {
    jest.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "mx.ok-domain.test", priority: 10 }]);
    expect(await checkEmailDeliverable("a@ok-domain.test")).toEqual({ ok: true });
  });

  it("rejects a domain that does not exist", async () => {
    jest.spyOn(dns, "resolveMx").mockRejectedValue(Object.assign(new Error("nx"), { code: "ENOTFOUND" }));
    jest.spyOn(dns, "resolve4").mockRejectedValue(Object.assign(new Error("nx"), { code: "ENOTFOUND" }));
    const verdict = await checkEmailDeliverable("a@no-such-domain-xyz.test");
    expect(verdict.ok).toBe(false);
  });

  it("falls back to an address record when there is no MX", async () => {
    jest.spyOn(dns, "resolveMx").mockRejectedValue(Object.assign(new Error("nodata"), { code: "ENODATA" }));
    jest.spyOn(dns, "resolve4").mockResolvedValue(["203.0.113.5"]);
    expect(await checkEmailDeliverable("a@a-record-only.test")).toEqual({ ok: true });
  });

  it("fails open when DNS itself is unavailable", async () => {
    jest.spyOn(dns, "resolveMx").mockRejectedValue(Object.assign(new Error("down"), { code: "ESERVFAIL" }));
    expect(await checkEmailDeliverable("a@dns-down.test")).toEqual({ ok: true });
  });

  it("rejects disposable domains before touching DNS", async () => {
    const spy = jest.spyOn(dns, "resolveMx");
    expect((await checkEmailDeliverable("a@yopmail.com")).ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
