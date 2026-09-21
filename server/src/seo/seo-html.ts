/**
 * Small, dependency-free helpers that build the HTML search engines and social networks read.
 *
 * The website is a single-page app, so its own HTML is nearly empty until JavaScript runs.
 * Many crawlers (Facebook, WhatsApp, X, LinkedIn, and often Bing) never run that JavaScript, so
 * they'd see the same generic page for every address. The API therefore produces a small,
 * complete HTML page for each public URL (see SeoService) and the website host hands crawlers
 * that page instead (vercel.json). Real visitors are unaffected.
 *
 * EVERYTHING that came from the database or an admin passes through escapeHtml() /
 * jsonLdScript() below — never place raw text into these pages.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON for a <script type="application/ld+json"> tag. "<" is escaped so text can never close the script early. */
export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, "");
  return `<script type="application/ld+json">${json}</script>`;
}

/** Shortens text to a search-result-sized snippet without cutting a word in half. */
export function snippet(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length).trim()}…`;
}

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute address of this page. */
  url: string;
  /** Absolute address of a preview picture. */
  image?: string | null;
  type?: "website" | "article" | "product";
  siteName: string;
  /** Extra head tags (structured data, verification, etc.), already escaped. */
  extraHead?: string[];
  /** Visible content for crawlers, already escaped HTML. */
  bodyHtml: string;
  noindex?: boolean;
  twitterHandle?: string | null;
}

/** A complete HTML document with the title, description, canonical address, Open Graph and Twitter cards. */
export function renderDocument(meta: PageMeta): string {
  const tags = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<link rel="canonical" href="${escapeHtml(meta.url)}">`,
    meta.noindex ? `<meta name="robots" content="noindex, nofollow">` : `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:site_name" content="${escapeHtml(meta.siteName)}">`,
    `<meta property="og:type" content="${meta.type ?? "website"}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${escapeHtml(meta.url)}">`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}">` : "",
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    meta.image ? `<meta name="twitter:image" content="${escapeHtml(meta.image)}">` : "",
    meta.twitterHandle ? `<meta name="twitter:site" content="${escapeHtml(meta.twitterHandle)}">` : "",
    ...(meta.extraHead ?? []),
  ].filter(Boolean);

  return `<!doctype html>\n<html lang="en">\n<head>\n${tags.join("\n")}\n</head>\n<body>\n${meta.bodyHtml}\n</body>\n</html>\n`;
}

/** Turns an address stored as "/uploads/x.webp" or "/api/media/x.webp" into a full web address. */
export function absoluteUrl(siteUrl: string, path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function sitemapXml(entries: Array<{ loc: string; lastmod?: Date | null; changefreq?: string; priority?: number }>): string {
  const rows = entries.map((entry) =>
    [
      "  <url>",
      `    <loc>${escapeHtml(entry.loc)}</loc>`,
      entry.lastmod ? `    <lastmod>${entry.lastmod.toISOString()}</lastmod>` : "",
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : "",
      entry.priority !== undefined ? `    <priority>${entry.priority.toFixed(1)}</priority>` : "",
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n")
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}
