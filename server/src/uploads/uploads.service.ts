import { Injectable } from "@nestjs/common";
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
@Injectable()
export class UploadsService {
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

  /** Reads one uploaded file from the private bucket. Returns null if it doesn't exist. */
  async readPrivateObject(
    filename: string
  ): Promise<{ body: Readable; contentType: string; contentLength?: number } | null> {
    if (!this.s3Client || !this.bucket) return null;
    try {
      const result = await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: filename }));
      if (!result.Body) return null;
      return {
        body: result.Body as Readable,
        contentType: result.ContentType ?? "image/webp",
        contentLength: result.ContentLength,
      };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") return null;
      throw error;
    }
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

    if (this.s3Client && this.bucket) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: filename,
          Body: optimizedImage,
          ContentType: "image/webp",
        })
      );
      // Private bucket: the browser can't fetch it directly, so hand out the API path.
      // (The frontend resolves this against the API's origin.)
      return { url: this.privateBucket ? `/api/media/${filename}` : this.buildPublicUrl(filename) };
    }

    const uploadsDir = join(process.cwd(), "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(join(uploadsDir, filename), optimizedImage);
    return { url: `/uploads/${filename}` };
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
