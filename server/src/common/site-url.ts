/**
 * The public address of the website, without a trailing slash. Used wherever the API must build a
 * full link to the site (sitemap, share cards, social posts). SITE_URL wins; otherwise FRONTEND_URL.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
}
