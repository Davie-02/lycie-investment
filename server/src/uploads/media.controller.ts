import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { UploadsService } from "./uploads.service";

/** Only the names this app generates (uuid + .webp) — never an arbitrary bucket key. */
export const MEDIA_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(-w(480|960))?\.webp$/;

/**
 * Serves uploaded images from a PRIVATE bucket (S3_PRIVATE_BUCKET=true).
 *
 * Public on purpose: vehicle photos are shown to anonymous visitors, exactly
 * as they would be from a public bucket. Access is limited to files whose
 * names this app generated, so it can't be used to read other bucket contents.
 * Filenames are random UUIDs and never change, so browsers may cache forever.
 * Not throttled: one vehicle page legitimately loads many images at once.
 */
@Controller("media")
@SkipThrottle()
export class MediaController {
  constructor(private readonly uploads: UploadsService) {}

  @Get(":filename")
  async serve(@Param("filename") filename: string, @Res() response: Response): Promise<void> {
    if (!this.uploads.isProxyingPrivateBucket || !MEDIA_FILENAME.test(filename)) {
      throw new NotFoundException();
    }

    const isResizedCopy = /-w\d+\.webp$/.test(filename);
    let file = await this.uploads.readPrivateObject(filename, isResizedCopy);

    // An older photo has no resized copy yet. Give the visitor the ORIGINAL right now (one request, no waiting) and
    // queue the smaller copy to be made gently in the background, so the next visitor gets the small file.
    let servedOriginal = false;
    if (!file && isResizedCopy) {
      const originalName = filename.replace(/-w\d+\.webp$/, ".webp");
      file = await this.uploads.readPrivateObject(originalName, true);
      if (file) {
        servedOriginal = true;
        this.uploads.scheduleVariant(filename);
      }
    }
    if (!file) throw new NotFoundException();

    response.setHeader("Content-Type", file.contentType);
    // The original stands in for a missing small copy only for now, so browsers should ask again soon.
    response.setHeader("Cache-Control", servedOriginal ? "public, max-age=600" : "public, max-age=31536000, immutable");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (file.contentLength !== undefined) response.setHeader("Content-Length", String(file.contentLength));

    file.body.on("error", () => response.destroy());
    file.body.pipe(response);
  }
}
