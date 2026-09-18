import { StrapiClientService } from "./strapi-client.service";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function withEnv(url: string | undefined, token: string | undefined): void {
  if (url === undefined) delete process.env.STRAPI_URL;
  else process.env.STRAPI_URL = url;
  if (token === undefined) delete process.env.STRAPI_API_TOKEN;
  else process.env.STRAPI_API_TOKEN = token;
}

describe("StrapiClientService", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  it("returns null without calling fetch when Strapi isn't configured", async () => {
    withEnv(undefined, undefined);
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new StrapiClientService();
    const result = await client.get("/api/testimonials");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the bearer token and returns the parsed body on success", async () => {
    withEnv("https://cms.example.com", "secret-token");
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 1 }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new StrapiClientService();
    const result = await client.get("/api/testimonials");

    expect(result).toEqual({ data: [{ id: 1 }] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cms.example.com/api/testimonials",
      expect.objectContaining({ headers: { Authorization: "Bearer secret-token" } })
    );
  });

  it("caches a successful response and doesn't refetch within the TTL", async () => {
    withEnv("https://cms.example.com", "secret-token");
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new StrapiClientService();
    await client.get("/api/testimonials");
    await client.get("/api/testimonials");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null (not a thrown error) when Strapi responds with a non-2xx status", async () => {
    withEnv("https://cms.example.com", "secret-token");
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const client = new StrapiClientService();
    await expect(client.get("/api/testimonials")).resolves.toBeNull();
  });

  it("returns null (not a thrown error) when the network request itself fails", async () => {
    withEnv("https://cms.example.com", "secret-token");
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const client = new StrapiClientService();
    await expect(client.get("/api/testimonials")).resolves.toBeNull();
  });

  describe("resolveMediaUrl", () => {
    it("returns null for a missing url", () => {
      withEnv("https://cms.example.com", "secret-token");
      const client = new StrapiClientService();
      expect(client.resolveMediaUrl(null)).toBeNull();
      expect(client.resolveMediaUrl(undefined)).toBeNull();
    });

    it("passes an already-absolute url through unchanged", () => {
      withEnv("https://cms.example.com", "secret-token");
      const client = new StrapiClientService();
      expect(client.resolveMediaUrl("https://cdn.example.com/photo.jpg")).toBe(
        "https://cdn.example.com/photo.jpg"
      );
    });

    it("prefixes a relative url with the configured Strapi base url", () => {
      withEnv("https://cms.example.com", "secret-token");
      const client = new StrapiClientService();
      expect(client.resolveMediaUrl("/uploads/photo.jpg")).toBe(
        "https://cms.example.com/uploads/photo.jpg"
      );
    });
  });
});
