import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";

export type DocumentKind = "pdf" | "docx" | "text" | "image";

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
/** Beyond this, a document would crowd out everything else Lycie knows. */
export const MAX_DOCUMENT_CHARS = 60_000;
export const CHUNK_CHARS = 1_800;

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "tsv", "json", "html", "htm"]);
const IMAGE_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

const startsWith = (buffer: Buffer, bytes: number[]) => bytes.every((b, i) => buffer[i] === b);

/**
 * Decides what a file really is from its first bytes AND its name, so a
 * renamed executable can't sneak in as ".pdf". Throws a friendly error for
 * anything unsupported.
 */
export function detectKind(buffer: Buffer, fileName: string): { kind: DocumentKind; mimeType: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "pdf") {
    if (!startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) throw new BadRequestException("That file isn't a valid PDF.");
    return { kind: "pdf", mimeType: "application/pdf" };
  }
  if (ext === "docx") {
    if (!startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) throw new BadRequestException("That file isn't a valid Word (.docx) document.");
    return { kind: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (IMAGE_MIME[ext]) {
    const isPng = startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]);
    const isJpeg = startsWith(buffer, [0xff, 0xd8, 0xff]);
    const isWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!(isPng || isJpeg || isWebp)) throw new BadRequestException("That file isn't a valid image.");
    return { kind: "image", mimeType: isPng ? "image/png" : isJpeg ? "image/jpeg" : "image/webp" };
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    // Text files must not contain binary bytes.
    if (buffer.subarray(0, 4_000).includes(0)) throw new BadRequestException("That file doesn't look like plain text.");
    return { kind: "text", mimeType: "text/plain" };
  }
  throw new BadRequestException(
    "Unsupported file type. Upload a PDF, Word (.docx), text/Markdown/CSV file, or a PNG/JPG/WebP image. (Old .doc files: save as .docx first.)"
  );
}

/** Strips markup and control characters and tidies whitespace. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ") // HTML files: keep the words, drop the tags
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits text into sections of at most `max` characters, breaking on
 * paragraph (then sentence, then word) boundaries so each section reads
 * sensibly on its own — Lycie retrieves sections, not whole files.
 */
export function chunkText(text: string, max = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  const addPiece = (piece: string) => {
    if (current && current.length + piece.length + 2 > max) push();
    current += (current ? "\n\n" : "") + piece;
  };

  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length <= max) {
      addPiece(paragraph);
      continue;
    }
    // A paragraph longer than a section: break it by sentences, then words.
    push();
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (sentence.length <= max) {
        if (current && current.length + sentence.length + 1 > max) push();
        current += (current ? " " : "") + sentence;
      } else {
        push();
        for (let i = 0; i < sentence.length; i += max) chunks.push(sentence.slice(i, i + max));
      }
    }
    push();
  }
  push();
  return chunks;
}

/** Guards against a file that yields almost nothing (e.g. a scanned PDF with no text layer). */
export function requireReadableText(text: string, kind: DocumentKind): string {
  if (text.replace(/\s/g, "").length < 20) {
    throw new UnprocessableEntityException(
      kind === "pdf"
        ? "No readable text was found in that PDF — it may be a scan. Upload the pages as images (PNG/JPG) instead, or paste the text as a note."
        : "No readable text was found in that file."
    );
  }
  return text.length > MAX_DOCUMENT_CHARS ? text.slice(0, MAX_DOCUMENT_CHARS) : text;
}
