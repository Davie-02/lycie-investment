import { describe, expect, it } from "vitest";
import { mailtoLink, mapQueryFor, mapsDirectionsUrl, mapsEmbedUrl, mapsSearchUrl, messageTemplate, telUrl, toInternationalDigits, whatsappUrl } from "./contactLinks";

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

describe("map helpers", () => {
  it("prefers the dedicated map text, falls back to the address, and can be empty", () => {
    expect(mapQueryFor("Lilongwe City Mall", "P.O. Box 440")).toBe("Lilongwe City Mall");
    expect(mapQueryFor("  ", "P.O. Box 440, Karonga")).toBe("P.O. Box 440, Karonga");
    expect(mapQueryFor(null, null)).toBe("");
  });

  it("URL-encodes the place so odd characters can't break the link", () => {
    expect(mapsSearchUrl("Area 3, Lilongwe & co")).toBe("https://www.google.com/maps/search/?api=1&query=Area%203%2C%20Lilongwe%20%26%20co");
    expect(mapsDirectionsUrl("-13.96, 33.77")).toContain("destination=-13.96%2C%2033.77");
    expect(mapsEmbedUrl("Karonga")).toBe("https://www.google.com/maps?q=Karonga&output=embed");
  });
});

describe("mailtoLink", () => {
  it("links real addresses and refuses junk", () => {
    expect(mailtoLink(" info@example.com ")).toBe("mailto:info@example.com");
    expect(mailtoLink("Contact our team")).toBeNull();
    expect(mailtoLink(null)).toBeNull();
  });
});
