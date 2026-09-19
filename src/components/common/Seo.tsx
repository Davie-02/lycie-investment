import { useEffect } from "react";
import { useSiteContent } from "@/context/SiteContentContext";

interface SeoProps {
  title: string;
  description?: string;
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
 * optional: pages that don't pass one fall back to the site-wide default
 * edited via /admin (SiteContent's "seo" section).
 */
export default function Seo({ title, description }: SeoProps) {
  const { content } = useSiteContent();

  useEffect(() => {
    document.title = `${title} | ${content.seo.siteName}`;

    setMeta(
      'meta[name="description"]',
      { name: "description" },
      description ?? content.seo.defaultDescription
    );

    if (content.seo.facebookAppId) {
      setMeta('meta[property="fb:app_id"]', { property: "fb:app_id" }, content.seo.facebookAppId);
    }
  }, [title, description, content.seo]);

  return null;
}
