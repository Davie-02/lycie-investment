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

describe("UploadsService background resizing (gentle by design)", () => {
  const id = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
  const knobs = UploadsService as unknown as { VARIANT_PAUSE_MS: number; VARIANT_MEMORY_LIMIT: number };
  const originalLimit = knobs.VARIANT_MEMORY_LIMIT;
  beforeEach(() => {
    knobs.VARIANT_PAUSE_MS = 5;
    knobs.VARIANT_MEMORY_LIMIT = Number.MAX_SAFE_INTEGER; // the test runner itself uses a lot of memory
  });
  afterEach(() => {
    knobs.VARIANT_MEMORY_LIMIT = originalLimit;
  });

  it("does no background work at all while memory is tight", async () => {
    const { service } = serviceWith(await fakeOriginal());
    const work = jest.fn(async () => Buffer.from("x"));
    (service as unknown as { runVariantWork: () => Promise<Buffer | null> }).runVariantWork = work;
    knobs.VARIANT_MEMORY_LIMIT = 1; // pretend the server is nearly out of memory
    service.scheduleVariant(`${id}-w480.webp`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(work).not.toHaveBeenCalled();
  });

  it("makes queued copies strictly one after another, never several at once", async () => {
    const { service } = serviceWith(await fakeOriginal());
    let running = 0;
    let peak = 0;
    const done: string[] = [];
    (service as unknown as { runVariantWork: (n: string) => Promise<Buffer | null> }).runVariantWork = async (name) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running--;
      done.push(name);
      return Buffer.from("x");
    };
    ["-w480", "-w960", "-w480"].forEach((suffix, i) => service.scheduleVariant(`${id}${i === 2 ? "b" : ""}${suffix}.webp`));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(done).toHaveLength(3);
    expect(peak).toBe(1);
  });

  it("does not queue the same copy twice", async () => {
    const { service } = serviceWith(await fakeOriginal());
    const work = jest.fn(async () => Buffer.from("x"));
    (service as unknown as { runVariantWork: () => Promise<Buffer | null> }).runVariantWork = work;
    for (let i = 0; i < 5; i++) service.scheduleVariant(`${id}-w480.webp`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("can be switched off, and stops queueing when the queue is full", async () => {
    const { service } = serviceWith(await fakeOriginal());
    const work = jest.fn(async () => Buffer.from("x"));
    (service as unknown as { runVariantWork: () => Promise<Buffer | null> }).runVariantWork = work;
    process.env.BACKFILL_PHOTO_SIZES = "false";
    service.scheduleVariant(`${id}-w480.webp`);
    delete process.env.BACKFILL_PHOTO_SIZES;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(work).not.toHaveBeenCalled();

    const queue = (service as unknown as { variantQueue: string[] }).variantQueue;
    queue.push(...Array.from({ length: UploadsService.VARIANT_QUEUE_MAX }, (_, i) => `q${i}`));
    service.scheduleVariant(`${id}-w960.webp`);
    expect(queue).not.toContain(`${id}-w960.webp`);
    queue.length = 0;
  });
});
