import { Injectable, Logger } from "@nestjs/common";

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

// Marketing content (testimonials, FAQ, blog, SEO settings) changes rarely,
// so a short cache avoids hitting Strapi on every homepage/FAQ page load
// without making edits feel like they take forever to show up.
const CACHE_TTL_MS = 60_000;

/**
 * Server-side-only client for the Strapi CMS. The frontend never talks to
 * Strapi directly — it goes through the NestJS endpoints in CmsController,
 * which is what keeps the Strapi API token off the public internet and lets
 * this app apply its own CORS/rate-limiting to CMS reads like everything else.
 */
@Injectable()
export class StrapiClientService {
  private readonly logger = new Logger(StrapiClientService.name);
  private readonly baseUrl = process.env.STRAPI_URL;
  private readonly token = process.env.STRAPI_API_TOKEN;
  private readonly cache = new Map<string, CacheEntry>();

  async get<T>(path: string): Promise<T | null> {
    const cached = this.cache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    if (!this.baseUrl || !this.token) {
      // CMS isn't configured (e.g. local dev without Strapi running) —
      // callers treat null the same as "no content published yet".
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) {
        this.logger.warn(`Strapi request failed: ${path} -> ${response.status}`);
        return null;
      }

      const body = (await response.json()) as T;
      this.cache.set(path, { value: body, expiresAt: Date.now() + CACHE_TTL_MS });
      return body;
    } catch (error) {
      this.logger.warn(`Strapi request errored: ${path} -> ${(error as Error).message}`);
      return null;
    }
  }

  resolveMediaUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return this.baseUrl ? `${this.baseUrl}${url}` : url;
  }
}
