import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContextService } from "./context.service";
import { GeminiBlockedError, GeminiClient, GeminiUnavailableError } from "./gemini.client";
import { CHUNK_CHARS, DocumentKind, chunkText, cleanText, detectKind, requireReadableText } from "./document-extract.util";

/* eslint-disable @typescript-eslint/no-require-imports */
// pdf-parse's package root runs a self-test that reads a demo file when imported
// in some setups; the inner module is the actual parser.
const pdfParse: (data: Buffer, options?: { max?: number }) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");
const mammoth: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> } = require("mammoth");
/* eslint-enable @typescript-eslint/no-require-imports */

const IMAGE_PROMPT =
  "This image is part of a vehicle dealer's business material (a price list, brochure, flyer, notice, screenshot or photo of a document). " +
  "Transcribe ALL text in it exactly, keeping numbers, prices, dates and names as written, and keep tables as simple lines. " +
  "If there is little or no text, describe briefly what it shows (vehicle model, condition, colour, visible details). " +
  "Plain text only, no commentary.";

/**
 * Lets admins teach Lycie by uploading files. The file's text is extracted on
 * our own server (PDF and Word never leave it), cut into sections, and stored
 * as knowledge entries she can retrieve like any other note. Only IMAGES are
 * read by Google's AI, since that is the only way to read them.
 */
@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: ContextService,
    private readonly gemini: GeminiClient
  ) {}

  async ingest(file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException("Choose a file to upload.");

    const fileName = file.originalname.replace(/^.*[\\/]/, "").replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "document";
    const { kind, mimeType } = detectKind(file.buffer, fileName);

    const raw = await this.extract(kind, file.buffer, mimeType);
    const cleaned = cleanText(raw);
    const text = requireReadableText(cleaned, kind);
    const chunks = chunkText(text, CHUNK_CHARS);

    const baseTitle = fileName.replace(/\.[^.]+$/, "").slice(0, 90);
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        fileName,
        mimeType,
        sizeBytes: file.size,
        charCount: text.length,
        entries: {
          create: chunks.map((content, index) => ({
            title: chunks.length === 1 ? baseTitle : `${baseTitle} (${index + 1}/${chunks.length})`,
            category: "other",
            content,
          })),
        },
      },
      include: { _count: { select: { entries: true } } },
    });
    this.context.invalidate();
    this.logger.log(`Ingested "${fileName}" (${kind}): ${text.length} chars in ${chunks.length} section(s).`);
    return { ...document, truncated: cleaned.length > text.length, preview: text.slice(0, 400) };
  }

  private async extract(kind: DocumentKind, buffer: Buffer, mimeType: string): Promise<string> {
    try {
      switch (kind) {
        case "pdf":
          return (await pdfParse(buffer, { max: 200 })).text;
        case "docx":
          return (await mammoth.extractRawText({ buffer })).value;
        case "text":
          return buffer.toString("utf8");
        case "image":
          return await this.readImage(buffer, mimeType);
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnprocessableEntityException) throw error;
      this.logger.warn(`Could not read ${kind}: ${error instanceof Error ? error.message : error}`);
      throw new UnprocessableEntityException(
        kind === "image"
          ? "Lycie's AI couldn't read that image right now. Try again in a moment."
          : `That ${kind === "pdf" ? "PDF" : "document"} couldn't be read — it may be damaged or password-protected.`
      );
    }
  }

  private async readImage(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.gemini.hasGemini) throw new UnprocessableEntityException("Reading images needs the Gemini key to be set up.");
    try {
      const { text } = await this.gemini.generate("You transcribe images for a knowledge base.", [
        { role: "user", text: IMAGE_PROMPT, image: { mimeType, data: buffer.toString("base64") } },
      ]);
      return text;
    } catch (error) {
      if (error instanceof GeminiBlockedError) throw new UnprocessableEntityException("That image couldn't be processed.");
      if (error instanceof GeminiUnavailableError) throw error;
      throw error;
    }
  }

  list() {
    return this.prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { entries: true } } },
    });
  }

  async sections(id: string) {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: { entries: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, content: true } } },
    });
    if (!document) throw new NotFoundException("Document not found.");
    return document;
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensure(id);
    await this.prisma.$transaction([
      this.prisma.knowledgeDocument.update({ where: { id }, data: { isActive } }),
      this.prisma.knowledgeEntry.updateMany({ where: { documentId: id }, data: { isActive } }),
    ]);
    this.context.invalidate();
  }

  async remove(id: string) {
    await this.ensure(id);
    await this.prisma.knowledgeDocument.delete({ where: { id } }); // sections are removed with it
    this.context.invalidate();
  }

  private async ensure(id: string) {
    if (!(await this.prisma.knowledgeDocument.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException("Document not found.");
    }
  }
}
