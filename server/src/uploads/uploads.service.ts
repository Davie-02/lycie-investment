import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
 * Either way, callers just get back a URL — nothing else in the app needs
 * to know or care which strategy is active.
 */
@Injectable()
export class UploadsService {
  private readonly s3Client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly publicUrlBase: string | undefined;

  constructor() {
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

  async upload(file: Express.Multer.File): Promise<{ url: string }> {
    const filename = `${randomUUID()}.webp`;
    const optimizedImage = await sharp(file.buffer)
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
      return { url: this.buildPublicUrl(filename) };
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
