import { describe, expect, it } from "vitest";
import { messageTemplate, telUrl, toInternationalDigits, whatsappUrl } from "./contactLinks";

describe("toInternationalDigits", () => {
  it("keeps numbers already in international format", () => {
    expect(toInternationalDigits("+265 991 383 466")).toBe("265991383466");
    expect(toInternationalDigits("+44 7700 900123")).toBe("447700900123");
  });

  it("turns local Malawi numbers into international ones", () => {
    expect(toInternationalDigits("0991 383 466")).toBe("265991383466");
    expect(toInternationalDigits("0881234567")).toBe("265881234567");
  });

  it("handles 00-prefixed and bare numbers", () => {
    expect(toInternationalDigits("00265991383466")).toBe("265991383466");
    expect(toInternationalDigits("265991383466")).toBe("265991383466");
    expect(toInternationalDigits("991383466")).toBe("265991383466");
  });

  it("rejects things that aren't phone numbers", () => {
    expect(toInternationalDigits("call me")).toBeNull();
    expect(toInternationalDigits("123")).toBeNull();
  });
});

describe("links", () => {
  it("builds a WhatsApp link with the message encoded", () => {
    expect(whatsappUrl("0991383466", "Hi Grace & co")).toBe("https://wa.me/265991383466?text=Hi%20Grace%20%26%20co");
  });

  it("builds tel links and returns null for bad numbers", () => {
    expect(telUrl("0991 383 466")).toBe("tel:+265991383466");
    expect(telUrl("n/a")).toBeNull();
    expect(whatsappUrl("n/a", "x")).toBeNull();
  });
});

describe("messageTemplate", () => {
  it("greets by first name and mentions the topic", () => {
    const t = messageTemplate("inquiry", "Grace Banda", "the Toyota Hilux 2022", "Davie");
    expect(t.body.startsWith("Hello Grace,")).toBe(true);
    expect(t.body).toContain("Toyota Hilux 2022");
    expect(t.body).toContain("Davie, Lycie Investments");
    expect(t.subject).toContain("Toyota Hilux 2022");
  });

  it("copes with a missing name", () => {
    expect(messageTemplate("contact", "", "Pricing").body.startsWith("Hello there,")).toBe(true);
  });
});
