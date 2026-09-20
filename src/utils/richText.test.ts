import { describe, expect, it } from "vitest";
import { parseInline, parseRichText } from "./richText";

describe("parseRichText", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    const blocks = parseRichText("First line\nsecond line\n\nNext paragraph");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "p" });
    expect((blocks[0] as { lines: unknown[] }).lines).toHaveLength(2);
  });

  it("recognises bullet and numbered lists, including odd bullet characters", () => {
    const blocks = parseRichText("Intro\n- one\n• two\n* three\n\n1. first\n2) second");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol"]);
    expect((blocks[1] as { items: unknown[] }).items).toHaveLength(3);
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("ends a list when normal text follows", () => {
    expect(parseRichText("- a\n- b\nThanks!").map((b) => b.type)).toEqual(["ul", "p"]);
  });

  it("returns nothing for empty input", () => {
    expect(parseRichText("  \n\n")).toEqual([]);
  });
});

describe("parseInline", () => {
  it("parses bold", () => {
    expect(parseInline("Price: **MWK 45,000,000** today")).toEqual([
      { type: "text", text: "Price: " },
      { type: "bold", text: "MWK 45,000,000" },
      { type: "text", text: " today" },
    ]);
  });

  it("links emails, phone numbers and web addresses", () => {
    const parts = parseInline("Call +265 991 383 466 or mail info@lycieinvestment.com, see https://lycie.example/x.");
    const links = parts.filter((p) => p.type === "link");
    expect(links).toEqual([
      { type: "link", text: "+265 991 383 466", href: "tel:+265991383466" },
      { type: "link", text: "info@lycieinvestment.com", href: "mailto:info@lycieinvestment.com" },
      { type: "link", text: "https://lycie.example/x", href: "https://lycie.example/x" },
    ]);
  });

  it("does not turn prices or years into phone numbers", () => {
    const parts = parseInline("Toyota Hilux 2022 costs MWK 45,000,000 or 12800000 cash");
    expect(parts.every((p) => p.type === "text")).toBe(true);
  });

  it("links Malawi local mobile numbers", () => {
    const [, link] = parseInline("Text 0991 383 466 now");
    expect(link).toMatchObject({ type: "link", href: "tel:0991383466" });
  });

  it("never produces HTML — markup stays as literal text", () => {
    const parts = parseInline("<img src=x onerror=alert(1)> **b**");
    expect(parts[0]).toEqual({ type: "text", text: "<img src=x onerror=alert(1)> " });
  });

  it("leaves an unfinished bold marker as plain text while streaming", () => {
    expect(parseInline("Hello **wor")).toEqual([{ type: "text", text: "Hello **wor" }]);
  });
});
