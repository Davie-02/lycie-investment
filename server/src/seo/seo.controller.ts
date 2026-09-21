import { Controller, Get, NotFoundException, Query, Res } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import { SeoService } from "./seo.service";

/**
 * Public, read-only endpoints for search engines and social networks. The website host forwards
 * /sitemap.xml, /robots.txt and (for crawler user-agents only) each public page to these — see vercel.json.
 * Not rate-limited: crawlers legitimately fetch many pages in a burst. Responses are cached for a
 * few minutes by browsers/CDNs so a crawl never hammers the database.
 */
@Controller("seo")
@SkipThrottle()
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get("sitemap.xml")
  async sitemap(@Res() response: Response) {
    response.type("application/xml").setHeader("Cache-Control", "public, max-age=3600");
    response.send(await this.seo.sitemap());
  }

  @Get("robots.txt")
  robots(@Res() response: Response) {
    response.type("text/plain").setHeader("Cache-Control", "public, max-age=3600");
    response.send(this.seo.robots());
  }

  /** The crawler version of one public page. `path` is the website address, e.g. /vehicles/toyota-hilux-2022. */
  @Get("render")
  async render(@Query("path") path: string | undefined, @Res() response: Response) {
    const html = await this.seo.renderPage(path ?? "/");
    if (!html) throw new NotFoundException("Page not found.");
    response.type("text/html").setHeader("Cache-Control", "public, max-age=300");
    response.send(html);
  }
}
