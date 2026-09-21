import { Injectable, Logger } from "@nestjs/common";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "stream";
import { randomUUID } from "crypto";
import { join } from "path";
import { promises as fs } from "fs";
import sharp from "sharp";

/**
 * Two storage strategies, selected automatically based on env config:
 *
 * - S3-compatible (AWS S3, Cloudflare R2, MinIO, ...) when S3_BUCKET is set.
 *   This is what production should use — local disk doesn't survive a
 *   redeploy on most hosts (Render, Railway, Fly, etc. all use ephemeral
 *   filesystems on the free/cheap tiers).
 * - Local disk (server/uploads/) otherwise, so development doesn't require
 *   real cloud credentials just to try the admin dashboard.
 *
 * A bucket can also be PRIVATE (S3_PRIVATE_BUCKET=true): some providers only
 * offer free public buckets with a card on file, while private ones are free.
 * In that mode files are stored privately and served through the API at
 * /api/media/:filename (see media.controller.ts), so no public bucket is needed.
 *
 * Either way, callers just get back a URL — nothing else in the app needs
 * to know or care which strategy is active.
 */
/** Extra widths generated for every upload (the original is kept at up to 2000px). */
export const IMAGE_VARIANT_WIDTHS = [480, 960];

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly publicUrlBase: string | undefined;
  private readonly privateBucket: boolean;

  constructor() {
    this.privateBucket = process.env.S3_PRIVATE_BUCKET === "true";
    this.bucket = process.env.S3_BUCKET;
    this.publicUrlBase = process.env.S3_PUBLIC_URL_BASE;

    if (this.bucket) {
      this.s3Client = new S3Client({
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      });
    } else {
      this.s3Client = null;
    }
  }

  get isUsingObjectStorage(): boolean {
    return this.s3Client !== null;
  }

  /** True when files live in a private bucket and are streamed through the API. */
  get isProxyingPrivateBucket(): boolean {
    return this.s3Client !== null && this.privateBucket;
  }

  /**
   * Reads one uploaded file from the private bucket. Returns null if it doesn't exist.
   * `quiet` is for resized copies (…-w960.webp): older photos never had them, so a miss is
   * expected and gets created on demand — not something to warn about.
   */
  async readPrivateObject(
    filename: string,
    quiet = false
  ): Promise<{ body: Readable; contentType: string; contentLength?: number } | null> {
    if (!this.s3Client || !this.bucket) return null;
    try {
      const result = await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: filename }));
      if (!result.Body) {
        this.logger.warn(`Storage returned an empty body for ${filename}.`);
        return null;
      }
      return {
        body: result.Body as Readable,
        contentType: result.ContentType ?? "image/webp",
        contentLength: result.ContentLength,
      };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") {
        // A 404 here means the file isn't in the bucket under this exact name.
        if (!quiet) this.logger.warn(`${filename} not found in bucket "${this.bucket}" (${name}).`);
        return null;
      }
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      this.logger.error(`Reading ${filename} from storage failed: ${name} (HTTP ${status ?? "?"})`);
      throw error;
    }
  }

  /** Copies still being made, so ten simultaneous requests for the same missing size do the work once. */
  private readonly pendingVariants = new Map<string, Promise<Buffer | null>>();

  /**
   * Photos uploaded before resized copies existed only have the original. When a browser asks
   * for "<id>-w960.webp" that doesn't exist yet, make it from the original, save it for next
   * time, and return it. Returns null when the original itself is missing (a real 404).
   * After the first visit each old photo therefore downloads at a fraction of its size.
   */
  createMissingVariant(variantName: string): Promise<Buffer | null> {
    const existing = this.pendingVariants.get(variantName);
    if (existing) return existing;

    const work = this.buildVariant(variantName).finally(() => this.pendingVariants.delete(variantName));
    this.pendingVariants.set(variantName, work);
    return work;
  }

  private async buildVariant(variantName: string): Promise<Buffer | null> {
    const match = /^(.+)-w(\d+)\.webp$/.exec(variantName);
    if (!match) return null;
    const width = Number(match[2]);
    if (!IMAGE_VARIANT_WIDTHS.includes(width)) return null;

    const original = await this.readPrivateObject(`${match[1]}.webp`);
    if (!original) return null;

    const chunks: Buffer[] = [];
    for await (const chunk of original.body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const resized = await sharp(Buffer.concat(chunks), { limitInputPixels: 50_000_000 })
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    // Saving is best-effort: if it fails the photo is still served, just rebuilt next time.
    await this.store(variantName, resized).catch((error) =>
      this.logger.warn(`Could not save ${variantName}: ${error instanceof Error ? error.message : error}`)
    );
    this.logger.log(`Created missing size ${variantName} from its original.`);
    return resized;
  }

  async upload(file: Express.Multer.File): Promise<{ url: string }> {
    const filename = `${randomUUID()}.webp`;
    // Caps decoded pixel count before resize runs — sharp's own default
    // (~268 megapixels) is generous enough that a crafted "decompression
    // bomb" image (tiny file, extreme declared dimensions) could still
    // spike memory/CPU during decode. No real vehicle photo needs more
    // than a fraction of this.
    const optimizedImage = await sharp(file.buffer, { limitInputPixels: 50_000_000 })
      .resize({ width: 2000, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    // Smaller copies for phones and list pages (…-w480.webp, …-w960.webp). The browser
    // picks the smallest that fits (srcset), so a vehicle grid downloads a fraction of the bytes.
    const variants = await Promise.all(
      IMAGE_VARIANT_WIDTHS.map(async (width) => ({
        name: `${filename.replace(/\.webp$/, "")}-w${width}.webp`,
        body: await sharp(optimizedImage).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
      }))
    );

    await this.store(filename, optimizedImage);
    await Promise.all(variants.map((variant) => this.store(variant.name, variant.body)));

    if (this.s3Client && this.bucket) {
      this.logger.log(`Stored ${filename} (+${variants.length} sizes) in bucket "${this.bucket}" (${optimizedImage.length} bytes).`);
      // Private bucket: the browser can't fetch it directly, so hand out the API path.
      // (The frontend resolves this against the API's origin.)
      return { url: this.privateBucket ? `/api/media/${filename}` : this.buildPublicUrl(filename) };
    }
    return { url: `/uploads/${filename}` };
  }

  private async store(name: string, body: Buffer): Promise<void> {
    if (this.s3Client && this.bucket) {
      await this.s3Client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: name, Body: body, ContentType: "image/webp" })
      );
      return;
    }
    const uploadsDir = join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(join(uploadsDir, name), body);
  }

  private buildPublicUrl(filename: string): string {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase.replace(/\/$/, "")}/${filename}`;
    }
    // Default AWS virtual-hosted-style URL. Works for real S3; for R2/MinIO
    // you almost always want S3_PUBLIC_URL_BASE set explicitly instead.
    const region = process.env.S3_REGION || "us-east-1";
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${filename}`;
  }
}
