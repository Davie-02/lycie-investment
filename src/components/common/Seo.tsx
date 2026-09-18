import { useEffect } from "react";
import { getSeoSettings } from "@/services/cms.service";
import type { SeoSettings } from "@/types/cms";

interface SeoProps {
  title: string;
  description?: string;
}

// Fetched once per page load, not once per <Seo> mount (every route renders
// one) — a module-level cache is the smallest way to get that without
// pulling in a data-fetching library for a single sitewide settings object.
let seoSettingsCache: Promise<SeoSettings | null> | null = null;
function loadSeoSettings(): Promise<SeoSettings | null> {
  if (!seoSettingsCache) {
    seoSettingsCache = getSeoSettings().catch(() => null);
  }
  return seoSettingsCache;
}

function setMeta(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Lightweight per-page SEO. Avoids pulling in react-helmet for a need this
 * small — see brief section 27 (minimal dependencies). `description` is
 * optional: pages that don't pass one fall back to the CMS's site-wide
 * default (server/src/cms), and finally to a hardcoded string if the CMS
 * isn't configured.
 */
export default function Seo({ title, description }: SeoProps) {
  useEffect(() => {
    let cancelled = false;

    loadSeoSettings().then((settings) => {
      if (cancelled) return;

      const siteName = settings?.siteName ?? "Lycie Investment";
      document.title = `${title} | ${siteName}`;

      setMeta(
        'meta[name="description"]',
        { name: "description" },
        description ?? settings?.defaultDescription ?? "Lycie Investment sources, imports, sells, hires and clears vehicles for customers in Malawi."
      );

      if (settings?.facebookAppId) {
        setMeta('meta[property="fb:app_id"]', { property: "fb:app_id" }, settings.facebookAppId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [title, description]);

  return null;
}
