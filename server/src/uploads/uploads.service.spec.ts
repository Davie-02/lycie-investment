import { Readable } from "stream";
import sharp from "sharp";
import { UploadsService } from "./uploads.service";

/** A real 1600px-wide WebP standing in for an old upload that has no resized copies. */
async function fakeOriginal(): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 900, channels: 3, background: "#19406c" } }).webp().toBuffer();
}

function serviceWith(original: Buffer | null) {
  const service = new UploadsService();
  const stored: string[] = [];
  const reads: string[] = [];
  const internals = service as unknown as {
    readPrivateObject: (name: string) => Promise<unknown>;
    store: (name: string, body: Buffer) => Promise<void>;
  };
  internals.readPrivateObject = async (name: string) => {
    reads.push(name);
    return original ? { body: Readable.from(original), contentType: "image/webp", contentLength: original.length } : null;
  };
  internals.store = async (name: string) => {
    stored.push(name);
  };
  return { service, stored, reads };
}

describe("UploadsService.createMissingVariant", () => {
  const id = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

  it("builds the missing smaller copy from the original, and saves it for next time", async () => {
    const { service, stored, reads } = serviceWith(await fakeOriginal());
    const buffer = await service.createMissingVariant(`${id}-w480.webp`);
    expect(buffer).not.toBeNull();
    expect((await sharp(buffer as Buffer).metadata()).width).toBe(480);
    expect(reads).toEqual([`${id}.webp`]);
    expect(stored).toEqual([`${id}-w480.webp`]);
  });

  it("returns null when even the original is gone (a genuine 404)", async () => {
    const { service, stored } = serviceWith(null);
    expect(await service.createMissingVariant(`${id}-w960.webp`)).toBeNull();
    expect(stored).toEqual([]);
  });

  it("refuses widths the app never generates, so it can't be used to make arbitrary images", async () => {
    const { service, reads } = serviceWith(await fakeOriginal());
    expect(await service.createMissingVariant(`${id}-w5000.webp`)).toBeNull();
    expect(reads).toEqual([]);
  });

  it("does the work once when many requests ask for the same missing copy at the same time", async () => {
    const { service, reads } = serviceWith(await fakeOriginal());
    await Promise.all(Array.from({ length: 6 }, () => service.createMissingVariant(`${id}-w960.webp`)));
    expect(reads).toHaveLength(1);
  });

  it("still serves the photo if saving the new copy fails", async () => {
    const { service } = serviceWith(await fakeOriginal());
    (service as unknown as { store: () => Promise<void> }).store = async () => {
      throw new Error("bucket unavailable");
    };
    expect(await service.createMissingVariant(`${id}-w480.webp`)).not.toBeNull();
  });
});
