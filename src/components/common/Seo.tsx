import { useEffect } from "react";

interface SeoProps {
  title: string;
  description: string;
}

/**
 * Lightweight per-page SEO. Avoids pulling in react-helmet for a need this
 * small — see brief section 27 (minimal dependencies).
 */
export default function Seo({ title, description }: SeoProps) {
  useEffect(() => {
    document.title = `${title} | Lycie Investment`;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [title, description]);

  return null;
}
