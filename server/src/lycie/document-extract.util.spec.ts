import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { chunkText, cleanText, detectKind, requireReadableText } from "./document-extract.util";

const pdf = Buffer.from("%PDF-1.7 rest");
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

describe("detectKind", () => {
  it("accepts files whose contents match their extension", () => {
    expect(detectKind(pdf, "Price List.PDF").kind).toBe("pdf");
    expect(detectKind(zip, "terms.docx").kind).toBe("docx");
    expect(detectKind(png, "brochure.png")).toEqual({ kind: "image", mimeType: "image/png" });
    expect(detectKind(Buffer.from("hello"), "notes.md").kind).toBe("text");
  });

  it("rejects a renamed file", () => {
    expect(() => detectKind(Buffer.from("MZ\u0090 program"), "invoice.pdf")).toThrow(BadRequestException);
    expect(() => detectKind(Buffer.from("just text"), "fake.docx")).toThrow(BadRequestException);
    expect(() => detectKind(Buffer.from([0, 1, 2, 3]), "data.txt")).toThrow(BadRequestException);
  });

  it("rejects unsupported types with guidance", () => {
    expect(() => detectKind(Buffer.from("x"), "run.exe")).toThrow(/Unsupported file type/);
    expect(() => detectKind(Buffer.from("x"), "old.doc")).toThrow(/docx/);
  });
});

describe("cleanText", () => {
  it("removes markup, control characters and excess whitespace", () => {
    expect(cleanText("<p>Hello   <b>world</b></p>\r\n\r\n\r\n\r\nNext\u0000line")).toBe("Hello world\n\nNextline");
  });

  it("drops scripts entirely", () => {
    expect(cleanText("a<script>alert(1)</script>b")).toBe("a b");
  });
});

describe("chunkText", () => {
  it("keeps short text as a single section", () => {
    expect(chunkText("One paragraph.")).toEqual(["One paragraph."]);
  });

  it("packs paragraphs without exceeding the limit or splitting them needlessly", () => {
    const paragraph = "word ".repeat(100).trim(); // ~500 chars
    const chunks = chunkText([paragraph, paragraph, paragraph, paragraph, paragraph].join("\n\n"), 1200);
    expect(chunks.length).toBe(3);
    expect(chunks.every((c) => c.length <= 1200)).toBe(true);
    expect(chunks.join(" ").split(/\s+/).filter(Boolean)).toHaveLength(500);
  });

  it("splits an oversized paragraph on sentence boundaries", () => {
    const sentence = "This is one sentence about importing vehicles. ";
    const chunks = chunkText(sentence.repeat(120), 500);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.every((c) => c.endsWith("."))).toBe(true);
  });

  it("hard-splits a single enormous token rather than looping forever", () => {
    const chunks = chunkText("x".repeat(5_000), 1_800);
    expect(chunks.map((c) => c.length)).toEqual([1800, 1800, 1400]);
  });
});

describe("requireReadableText", () => {
  it("explains empty scanned PDFs", () => {
    expect(() => requireReadableText("  \n ", "pdf")).toThrow(UnprocessableEntityException);
    expect(() => requireReadableText(" ", "pdf")).toThrow(/scan/);
  });

  it("caps very long documents", () => {
    expect(requireReadableText("a".repeat(100_000), "text")).toHaveLength(60_000);
  });
});
