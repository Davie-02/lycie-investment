import { NotFoundException } from "@nestjs/common";
import { Readable } from "stream";
import { MEDIA_FILENAME, MediaController } from "./media.controller";
import type { UploadsService } from "./uploads.service";

const GOOD = "3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b.webp";

function makeResponse() {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  const response = {
    headers,
    chunks,
    setHeader: (k: string, v: string) => (headers[k] = v),
    destroy: jest.fn(),
    write: (c: Buffer) => (chunks.push(Buffer.from(c)), true),
    end: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
  };
  return response;
}

function controller(overrides: Partial<UploadsService> = {}) {
  const uploads = {
    isProxyingPrivateBucket: true,
    readPrivateObject: jest.fn(async () => ({ body: Readable.from([Buffer.from("img")]), contentType: "image/webp", contentLength: 3 })),
    ...overrides,
  } as unknown as UploadsService;
  return { controller: new MediaController(uploads), uploads };
}

describe("MEDIA_FILENAME", () => {
  it("accepts generated names only", () => {
    expect(MEDIA_FILENAME.test(GOOD)).toBe(true);
    for (const bad of ["../secret.webp", "a.webp", `${GOOD}/x`, "3f2b8c1e-9a4d-4e6f-8b1a-2c3d4e5f6a7b.png", "%2e%2e/x.webp"]) {
      expect(MEDIA_FILENAME.test(bad)).toBe(false);
    }
  });
});

describe("MediaController", () => {
  it("404s for names it didn't generate, without touching storage", async () => {
    const { controller: c, uploads } = controller();
    await expect(c.serve("../../etc/passwd", makeResponse() as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(uploads.readPrivateObject).not.toHaveBeenCalled();
  });

  it("404s when the app isn't using a private bucket", async () => {
    const { controller: c } = controller({ isProxyingPrivateBucket: false } as never);
    await expect(c.serve(GOOD, makeResponse() as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("404s when the file doesn't exist", async () => {
    const { controller: c } = controller({ readPrivateObject: jest.fn(async () => null) } as never);
    await expect(c.serve(GOOD, makeResponse() as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("serves the image with long-lived cache headers", async () => {
    const { controller: c } = controller();
    const response = makeResponse();
    await c.serve(GOOD, response as never);
    expect(response.headers["Content-Type"]).toBe("image/webp");
    expect(response.headers["Cache-Control"]).toContain("immutable");
    expect(response.headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
