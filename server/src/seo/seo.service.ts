import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "../content-admin/content-state";
import { PricingService } from "../pricing/pricing.service";
import { priceText, toUsd } from "../pricing/price-format";
import { absoluteUrl, escapeHtml, jsonLdScript, renderDocument, sitemapXml, snippet } from "./seo-html";

type Json = Record<string, unknown>;

/** The static public pages, in the order they appear in the sitemap. */
const STATIC_PAGES: Array<{ path: string; priority: number; changefreq: string }> = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/vehicles", priority: 0.9, changefreq: "daily" },
  { path: "/hire", priority: 0.8, changefreq: "weekly" },
  { path: "/import", priority: 0.8, changefreq: "monthly" },
  { path: "/clearing", priority: 0.7, changefreq: "monthly" },
  { path: "/deals", priority: 0.8, changefreq: "daily" },
  { path: "/about", priority: 0.6, changefreq: "monthly" },
  { path: "/contact", priority: 0.7, changefreq: "monthly" },
  { path: "/faq", priority: 0.6, changefreq: "weekly" },
  { path: "/blog", priority: 0.6, changefreq: "weekly" },
  { path: "/reviews", priority: 0.5, changefreq: "weekly" },
];

interface SiteInfo {
  name: string;
  description: string;
  url: string;
  ogImage: string | null;
  twitterHandle: string | null;
  phone: string;
  email: string;
  address: string;
  social: string[];
  verification: string[];
}

/**
 * Everything search engines and social networks need to find, understand and preview the site:
 *  - a plain HTML version of every public page (title, description, Open Graph/Twitter cards,
 *    structured data) that crawlers receive instead of the empty single-page-app shell;
 *  - sitemap.xml and robots.txt.
 * All wording and images come from the same admin-managed content as the live site.
 */
@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService
  ) {}

  /** The public address of the website (no trailing slash). SITE_URL, else FRONTEND_URL. */
  siteUrl(): string {
    return (process.env.SITE_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  }

  private async site(): Promise<SiteInfo> {
    const rows = await this.prisma.siteContent.findMany({ where: { key: { in: ["seo", "contact", "social"] } } });
    const byKey = Object.fromEntries(rows.map((row) => [row.key, (row.value ?? {}) as Json]));
    const seo = byKey.seo ?? {};
    const contact = byKey.contact ?? {};
    const social = byKey.social ?? {};
    const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const url = this.siteUrl();

    return {
      name: str(seo.siteName) || "Lycie Investments",
      description: str(seo.defaultDescription) || "Lycie Investments sources, imports, sells, hires and clears vehicles for customers in Malawi.",
      url,
      ogImage: absoluteUrl(url, str(seo.ogImage) || null),
      twitterHandle: str(seo.twitterHandle) || null,
      phone: str(contact.phone),
      email: str(contact.email),
      address: str(contact.address),
      social: Object.values(social).map(str).filter((link) => /^https?:\/\//i.test(link)),
      verification: [
        str(seo.googleVerification) ? `<meta name="google-site-verification" content="${escapeHtml(str(seo.googleVerification))}">` : "",
        str(seo.bingVerification) ? `<meta name="msvalidate.01" content="${escapeHtml(str(seo.bingVerification))}">` : "",
      ].filter(Boolean),
    };
  }

  /** The company as a local business, shown to Google (name, phone, address, social profiles). */
  private organizationLd(site: SiteInfo): Json {
    return {
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      name: site.name,
      url: site.url,
      description: site.description,
      ...(site.ogImage ? { image: site.ogImage } : {}),
      ...(site.phone ? { telephone: site.phone } : {}),
      ...(site.email ? { email: site.email } : {}),
      ...(site.address ? { address: { "@type": "PostalAddress", streetAddress: site.address, addressCountry: "MW" } } : {}),
      areaServed: { "@type": "Country", name: "Malawi" },
      ...(site.social.length ? { sameAs: site.social } : {}),
    };
  }

  private nav(site: SiteInfo): string {
    const links = STATIC_PAGES.map((page) => `<li><a href="${escapeHtml(site.url + page.path)}">${escapeHtml(page.path === "/" ? "Home" : page.path.slice(1))}</a></li>`);
    return `<nav><ul>${links.join("")}</ul></nav>`;
  }

  // ------------------------------------------------------------------ sitemap & robots

  async sitemap(): Promise<string> {
    const site = await this.site();
    const [vehicles, posts] = await Promise.all([
      this.prisma.vehicle.findMany({ where: PUBLIC.vehicles, select: { slug: true, updatedAt: true } }),
      this.prisma.blogPost.findMany({ where: PUBLIC["blog-posts"], select: { slug: true, updatedAt: true } }),
    ]);
    return sitemapXml([
      ...STATIC_PAGES.map((page) => ({ loc: site.url + page.path, changefreq: page.changefreq, priority: page.priority })),
      ...vehicles.map((v) => ({ loc: `${site.url}/vehicles/${v.slug}`, lastmod: v.updatedAt, changefreq: "weekly", priority: 0.8 })),
      ...posts.map((p) => ({ loc: `${site.url}/blog/${p.slug}`, lastmod: p.updatedAt, changefreq: "monthly", priority: 0.5 })),
    ]);
  }

  robots(): string {
    const url = this.siteUrl();
    return ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /account", "", `Sitemap: ${url}/sitemap.xml`, ""].join("\n");
  }

  // ------------------------------------------------------------------ page rendering

  /**
   * The crawler version of a page, or null when the address isn't a public page (or the vehicle /
   * post no longer exists). `path` is the address on the website, e.g. "/vehicles/toyota-hilux-2022".
   */
  async renderPage(rawPath: string): Promise<string | null> {
    const path = "/" + rawPath.replace(/[^a-zA-Z0-9\-_/]/g, "").replace(/^\/+|\/+$/g, "");
    const site = await this.site();
    const verification = site.verification;
    const base = { siteName: site.name, twitterHandle: site.twitterHandle, extraHead: [...verification] };

    const vehicleMatch = /^\/vehicles\/([\w-]+)$/.exec(path);
    if (vehicleMatch) return this.vehiclePage(vehicleMatch[1], site, base);
    const postMatch = /^\/blog\/([\w-]+)$/.exec(path);
    if (postMatch) return this.blogPostPage(postMatch[1], site, base);

    const url = site.url + (path === "/" ? "/" : path);
    switch (path) {
      case "/":
        return renderDocument({
          ...base,
          title: `${site.name} — vehicle import, sales, hire & clearing in Malawi`,
          description: snippet(site.description),
          url,
          image: site.ogImage,
          extraHead: [...verification, jsonLdScript(this.organizationLd(site))],
          bodyHtml: `<h1>${escapeHtml(site.name)}</h1><p>${escapeHtml(site.description)}</p>${this.nav(site)}`,
        });
      case "/vehicles":
        return this.vehicleListPage(site, base, url);
      case "/faq":
        return this.faqPage(site, base, url);
      case "/blog":
        return this.blogListPage(site, base, url);
      case "/hire":
      case "/import":
      case "/clearing":
      case "/about":
      case "/contact":
      case "/reviews":
      case "/deals":
        return this.contentPage(path, site, base, url);
      default:
        return null;
    }
  }

  private async contentPage(path: string, site: SiteInfo, base: Json, url: string): Promise<string> {
    const rows = await this.prisma.siteContent.findMany({ where: { key: { in: ["hirePage", "importPage", "clearingPage", "about", "pageHeadings"] } } });
    const content = Object.fromEntries(rows.map((row) => [row.key, (row.value ?? {}) as Json]));
    const headings = (content.pageHeadings ?? {}) as Record<string, { heading?: string; body?: string }>;

    const titles: Record<string, { heading: string; body: string }> = {
      "/hire": { heading: String((content.hirePage as Json)?.heading ?? "Vehicle hire"), body: String((content.hirePage as Json)?.body ?? "Vehicles ready for hire in Malawi.") },
      "/import": { heading: String((content.importPage as Json)?.heading ?? "Vehicle importing"), body: String((content.importPage as Json)?.body ?? "We source and import the vehicle you want.") },
      "/clearing": { heading: String((content.clearingPage as Json)?.heading ?? "Vehicle clearing"), body: String((content.clearingPage as Json)?.body ?? "Clearing and documentation support once your vehicle arrives.") },
      "/about": { heading: `About ${site.name}`, body: String((content.about as Json)?.intro ?? site.description) },
      "/contact": { heading: headings.contact?.heading ?? "Contact us", body: `${headings.contact?.body ?? ""} ${site.phone} ${site.email} ${site.address}`.trim() },
      "/reviews": { heading: headings.reviews?.heading ?? "Customer reviews", body: headings.reviews?.body ?? "What customers say about us." },
      "/deals": { heading: "Deals & promotions", body: "Current promotions on vehicles from " + site.name + "." },
    };
    const page = titles[path];
    return renderDocument({
      ...(base as object),
      title: `${page.heading} | ${site.name}`,
      description: snippet(page.body || site.description),
      url,
      image: site.ogImage,
      bodyHtml: `<h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.body)}</p>${this.nav(site)}`,
    } as Parameters<typeof renderDocument>[0]);
  }

  private async vehicleListPage(site: SiteInfo, base: Json, url: string): Promise<string> {
    const { rate, roundMwkTo } = await this.pricing.getEffectiveRate();
    const vehicles = await this.prisma.vehicle.findMany({ where: PUBLIC.vehicles, orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }], take: 60 });
    const items = vehicles.map(
      (v) => `<li><a href="${escapeHtml(`${site.url}/vehicles/${v.slug}`)}">${escapeHtml(`${v.make} ${v.model} ${v.year}`)}</a> — ${escapeHtml(priceText(v.price, v.currency, rate, roundMwkTo))}</li>`
    );
    return renderDocument({
      ...(base as object),
      title: `Vehicles for sale | ${site.name}`,
      description: snippet(`Browse ${vehicles.length} quality vehicles for sale in Malawi from ${site.name}: ${vehicles.slice(0, 4).map((v) => `${v.make} ${v.model}`).join(", ")} and more.`),
      url,
      image: absoluteUrl(site.url, vehicles[0]?.images[0]) ?? site.ogImage,
      extraHead: [
        ...site.verification,
        jsonLdScript({ "@context": "https://schema.org", "@type": "ItemList", itemListElement: vehicles.map((v, i) => ({ "@type": "ListItem", position: i + 1, url: `${site.url}/vehicles/${v.slug}`, name: `${v.make} ${v.model} ${v.year}` })) }),
      ],
      bodyHtml: `<h1>Vehicles for sale</h1><ul>${items.join("")}</ul>${this.nav(site)}`,
    } as Parameters<typeof renderDocument>[0]);
  }

  private async vehiclePage(slug: string, site: SiteInfo, base: Json): Promise<string | null> {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { ...PUBLIC.vehicles, slug } });
    if (!vehicle) return null;
    const { rate, roundMwkTo } = await this.pricing.getEffectiveRate();
    const usd = toUsd(vehicle.price, vehicle.currency, rate);
    const name = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
    const url = `${site.url}/vehicles/${vehicle.slug}`;
    const images = vehicle.images.map((image) => absoluteUrl(site.url, image)).filter((image): image is string => Boolean(image));
    const availability = vehicle.status === "sold" ? "https://schema.org/SoldOut" : vehicle.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock";
    const description = `${name} — ${priceText(vehicle.price, vehicle.currency, rate, roundMwkTo)}. ${vehicle.transmission}, ${vehicle.fuelType}, ${vehicle.mileageKm.toLocaleString("en-US")} km. ${vehicle.description}`;

    return renderDocument({
      ...(base as object),
      title: `${name} for sale | ${site.name}`,
      description: snippet(description),
      url,
      image: images[0] ?? site.ogImage,
      type: "product",
      extraHead: [
        ...site.verification,
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "Car",
          name,
          brand: { "@type": "Brand", name: vehicle.make },
          model: vehicle.model,
          vehicleModelDate: String(vehicle.year),
          mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileageKm, unitCode: "KMT" },
          fuelType: vehicle.fuelType,
          vehicleTransmission: vehicle.transmission,
          bodyType: vehicle.bodyType,
          description: vehicle.description,
          ...(images.length ? { image: images } : {}),
          url,
          ...(usd !== null
            ? { offers: { "@type": "Offer", price: Math.round(usd), priceCurrency: "USD", availability, url, seller: { "@type": "Organization", name: site.name } } }
            : {}),
        }),
      ],
      bodyHtml: `<h1>${escapeHtml(name)}</h1><p>${escapeHtml(priceText(vehicle.price, vehicle.currency, rate, roundMwkTo))}</p><p>${escapeHtml(vehicle.description)}</p>${this.nav(site)}`,
    } as Parameters<typeof renderDocument>[0]);
  }

  private async faqPage(site: SiteInfo, base: Json, url: string): Promise<string> {
    const faqs = await this.prisma.faq.findMany({ where: PUBLIC.faq, orderBy: { sortOrder: "asc" }, take: 50 });
    return renderDocument({
      ...(base as object),
      title: `Frequently asked questions | ${site.name}`,
      description: snippet(`Answers about importing, buying, hiring and clearing vehicles in Malawi: ${faqs.slice(0, 3).map((f) => f.question).join(" ")}`),
      url,
      image: site.ogImage,
      extraHead: [
        ...site.verification,
        jsonLdScript({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }),
      ],
      bodyHtml: `<h1>Frequently asked questions</h1>${faqs.map((f) => `<h2>${escapeHtml(f.question)}</h2><p>${escapeHtml(f.answer)}</p>`).join("")}${this.nav(site)}`,
    } as Parameters<typeof renderDocument>[0]);
  }

  private async blogListPage(site: SiteInfo, base: Json, url: string): Promise<string> {
    const posts = await this.prisma.blogPost.findMany({ where: PUBLIC["blog-posts"], orderBy: { publishedAt: "desc" }, take: 50 });
    return renderDocument({
      ...(base as object),
      title: `Blog | ${site.name}`,
      description: snippet(`News, guides and updates from ${site.name}. ${posts.slice(0, 3).map((p) => p.title).join(" · ")}`),
      url,
      image: absoluteUrl(site.url, posts[0]?.coverImageUrl) ?? site.ogImage,
      bodyHtml: `<h1>Blog</h1><ul>${posts.map((p) => `<li><a href="${escapeHtml(`${site.url}/blog/${p.slug}`)}">${escapeHtml(p.title)}</a></li>`).join("")}</ul>${this.nav(site)}`,
    } as Parameters<typeof renderDocument>[0]);
  }

  private async blogPostPage(slug: string, site: SiteInfo, base: Json): Promise<string | null> {
    const post = await this.prisma.blogPost.findFirst({ where: { ...PUBLIC["blog-posts"], slug } });
    if (!post) return null;
    const url = `${site.url}/blog/${post.slug}`;
    const image = absoluteUrl(site.url, post.coverImageUrl) ?? site.ogImage;
    const description = post.seoDescription || post.excerpt || post.body;
    return renderDocument({
      ...(base as object),
      title: `${post.seoTitle || post.title} | ${site.name}`,
      description: snippet(description),
      url,
      image,
      type: "article",
      extraHead: [
        ...site.verification,
        jsonLdScript({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: snippet(description),
          ...(image ? { image } : {}),
          datePublished: (post.publishedAt ?? post.createdAt).toISOString(),
          dateModified: post.updatedAt.toISOString(),
          mainEntityOfPage: url,
          publisher: { "@type": "Organization", name: site.name },
        }),
      ],
      bodyHtml: `<article><h1>${escapeHtml(post.title)}</h1>${post.body.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</article>${this.nav(site)}`,
    } as Parameters<typeof renderDocument>[0]);
  }
}
