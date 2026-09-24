import { promises as dns } from "dns";
import {
  checkEmailDeliverable,
  hasValidEmailShape,
  interpretMailboxResponse,
  isDisposableEmail,
  isNonPublicAddress,
  normalizeEmail,
  suggestDomainFix,
} from "./email-check";

const nx = (code = "ENOTFOUND") => Object.assign(new Error(code), { code });

describe("email-check", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.EMAIL_VERIFICATION_PROVIDER;
    delete process.env.EMAIL_VERIFICATION_API_KEY;
  });

  it("normalises case and whitespace", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });

  it("checks the shape of an address", () => {
    expect(hasValidEmailShape("jane.doe+cars@example.co.mw")).toBe(true);
    expect(hasValidEmailShape("jane..doe@example.com")).toBe(false);
    expect(hasValidEmailShape("jane@example")).toBe(false);
    expect(hasValidEmailShape("jane@-example.com")).toBe(false);
    expect(hasValidEmailShape(`${"a".repeat(65)}@example.com`)).toBe(false);
  });

  it("spots typos of big providers, including ones that have mail servers", () => {
    expect(suggestDomainFix("gmial.com")).toBe("gmail.com");
    expect(suggestDomainFix("gmail.con")).toBe("gmail.com");
    expect(suggestDomainFix("gmail.co")).toBe("gmail.com");
    expect(suggestDomainFix("yahooo.com")).toBe("yahoo.com");
    expect(suggestDomainFix("outlok.com")).toBe("outlook.com");
    expect(suggestDomainFix("hotmial.com")).toBe("hotmail.com");
  });

  it("leaves genuine domains alone", () => {
    for (const domain of ["gmail.com", "yahoo.co.uk", "hotmail.fr", "mail.com", "email.com", "cloud.com", "lycie.mw", "company.com"]) {
      expect(suggestDomainFix(domain)).toBeNull();
    }
  });

  it("flags disposable inbox providers, including their subdomains", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@abc.mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@gmail.com")).toBe(false);
  });

  it("recognises addresses that can't be a public mail server", () => {
    expect(isNonPublicAddress("127.0.0.1")).toBe(true);
    expect(isNonPublicAddress("192.168.1.4")).toBe(true);
    expect(isNonPublicAddress("::1")).toBe(true);
    expect(isNonPublicAddress("203.0.113.5")).toBe(false);
  });

  it("accepts a domain whose mail servers resolve publicly", async () => {
    jest.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "mx.ok-domain.test", priority: 10 }]);
    jest.spyOn(dns, "resolve4").mockResolvedValue(["203.0.113.5"]);
    jest.spyOn(dns, "resolve6").mockRejectedValue(nx("ENODATA"));
    expect(await checkEmailDeliverable("a@ok-domain.test")).toEqual({ ok: true });
  });

  it("rejects a null MX (a domain that says it never receives mail)", async () => {
    jest.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "", priority: 0 }]);
    expect((await checkEmailDeliverable("a@null-mx.test")).ok).toBe(false);
  });

  it("rejects mail servers that point at private or missing addresses", async () => {
    jest.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "mx.local-only.test", priority: 10 }]);
    jest.spyOn(dns, "resolve4").mockResolvedValue(["127.0.0.1"]);
    jest.spyOn(dns, "resolve6").mockRejectedValue(nx("ENODATA"));
    expect((await checkEmailDeliverable("a@local-only.test")).ok).toBe(false);
  });

  it("rejects a domain that does not exist", async () => {
    jest.spyOn(dns, "resolveMx").mockRejectedValue(nx());
    jest.spyOn(dns, "resolve4").mockRejectedValue(nx());
    jest.spyOn(dns, "resolve6").mockRejectedValue(nx());
    const verdict = await checkEmailDeliverable("a@no-such-domain-xyz.test");
    expect(verdict.ok).toBe(false);
  });

  it("falls back to an address record when there is no MX", async () => {
    jest.spyOn(dns, "resolveMx").mockRejectedValue(nx("ENODATA"));
    jest.spyOn(dns, "resolve4").mockResolvedValue(["203.0.113.5"]);
    jest.spyOn(dns, "resolve6").mockRejectedValue(nx("ENODATA"));
    expect(await checkEmailDeliverable("a@a-record-only.test")).toEqual({ ok: true });
  });

  it("fails open when DNS itself is unavailable", async () => {
    jest.spyOn(dns, "resolveMx").mockRejectedValue(nx("ESERVFAIL"));
    expect(await checkEmailDeliverable("a@dns-down.test")).toEqual({ ok: true });
  });

  it("rejects typos and disposable domains before touching DNS, with a suggestion for typos", async () => {
    const spy = jest.spyOn(dns, "resolveMx");
    expect((await checkEmailDeliverable("a@yopmail.com")).ok).toBe(false);
    const typo = await checkEmailDeliverable("jane@gmial.com");
    expect(typo).toMatchObject({ ok: false, suggestion: "jane@gmail.com" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("reads each verification service's answer", () => {
    expect(interpretMailboxResponse("kickbox", { result: "undeliverable" })).toBe("undeliverable");
    expect(interpretMailboxResponse("kickbox", { result: "risky", disposable: true })).toBe("disposable");
    expect(interpretMailboxResponse("zerobounce", { status: "valid" })).toBe("deliverable");
    expect(interpretMailboxResponse("zerobounce", { status: "catch-all" })).toBe("unknown");
    expect(interpretMailboxResponse("abstract", { deliverability: "UNDELIVERABLE", is_disposable_email: { value: false } })).toBe("undeliverable");
  });

  it("rejects a mailbox the verification service says doesn't exist, and fails open when it's down", async () => {
    jest.spyOn(dns, "resolveMx").mockResolvedValue([{ exchange: "mx.real.test", priority: 10 }]);
    jest.spyOn(dns, "resolve4").mockResolvedValue(["203.0.113.5"]);
    jest.spyOn(dns, "resolve6").mockRejectedValue(nx("ENODATA"));
    process.env.EMAIL_VERIFICATION_PROVIDER = "kickbox";
    process.env.EMAIL_VERIFICATION_API_KEY = "test";

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: "undeliverable" }), { status: 200 }));
    expect((await checkEmailDeliverable("nobody@real.test", { verifyMailbox: true })).ok).toBe(false);

    fetchSpy.mockRejectedValue(new Error("network down"));
    expect(await checkEmailDeliverable("someone-else@real.test", { verifyMailbox: true })).toEqual({ ok: true });
  });
});
