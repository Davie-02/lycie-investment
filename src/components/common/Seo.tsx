import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSiteContent } from "@/context/SiteContentContext";
import { absolute } from "@/utils/structuredData";

interface SeoProps {
  title: string;
  description?: string;
  /** A preview picture for search results and social shares (address or "/uploads/…" path). */
  image?: string | null;
  type?: "website" | "article" | "product";
  /** Ask search engines not to list this page (sign-in, account pages). */
  noindex?: boolean;
  /** Structured data (JSON-LD) describing the page's subject. */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

/** Creates or updates one <meta>/<link> tag in <head>. */
function setTag(tag: "meta" | "link", match: Record<string, string>, value: Record<string, string>) {
  const selector = `${tag}${Object.entries(match).map(([key, val]) => `[${key}="${val}"]`).join("")}`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tag);
    Object.entries(match).forEach(([key, val]) => el!.setAttribute(key, val));
    document.head.appendChild(el);
  }
  Object.entries(value).forEach(([key, val]) => el!.setAttribute(key, val));
}

/**
 * Per-page search and sharing information, kept up to date as visitors move between pages: title,
 * description, canonical address, Open Graph and Twitter preview cards, robots instruction, search
 * console verification codes and structured data.
 *
 * Small on purpose (no react-helmet). Defaults and the preview picture come from Admin → Site
 * Content → SEO. Crawlers that don't run JavaScript get an equivalent page from the API instead
 * (see server/src/seo/).
 */
export default function Seo({ title, description, image, type = "website", noindex = false, jsonLd }: SeoProps) {
  const { content } = useSiteContent();
  const { pathname } = useLocation();
  const { seo } = content;

  useEffect(() => {
    const origin = window.location.origin;
    const fullTitle = `${title} | ${seo.siteName}`;
    const text = description ?? seo.defaultDescription;
    const url = `${origin}${pathname === "/" ? "/" : pathname.replace(/\/+$/, "")}`;
    const preview = absolute(origin, image ?? seo.ogImage);

    document.title = fullTitle;
    setTag("meta", { name: "description" }, { content: text });
    setTag("link", { rel: "canonical" }, { href: url });
    setTag("meta", { name: "robots" }, { content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large" });

    setTag("meta", { property: "og:site_name" }, { content: seo.siteName });
    setTag("meta", { property: "og:type" }, { content: type });
    setTag("meta", { property: "og:title" }, { content: fullTitle });
    setTag("meta", { property: "og:description" }, { content: text });
    setTag("meta", { property: "og:url" }, { content: url });
    setTag("meta", { name: "twitter:card" }, { content: preview ? "summary_large_image" : "summary" });
    setTag("meta", { name: "twitter:title" }, { content: fullTitle });
    setTag("meta", { name: "twitter:description" }, { content: text });
    if (preview) {
      setTag("meta", { property: "og:image" }, { content: preview });
      setTag("meta", { name: "twitter:image" }, { content: preview });
    }
    if (seo.twitterHandle) setTag("meta", { name: "twitter:site" }, { content: seo.twitterHandle });
    if (seo.facebookAppId) setTag("meta", { property: "fb:app_id" }, { content: seo.facebookAppId });
    if (seo.googleVerification) setTag("meta", { name: "google-site-verification" }, { content: seo.googleVerification });
    if (seo.bingVerification) setTag("meta", { name: "msvalidate.01" }, { content: seo.bingVerification });

    // Structured data: one script tag we own, replaced per page and removed when the page unmounts.
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seo = "page";
      script.text = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
      document.head.appendChild(script);
    }
    return () => script?.remove();
  }, [title, description, image, type, noindex, jsonLd, pathname, seo]);

  return null;
}
