import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSiteContent } from "@/services/siteContent.service";
import { DEFAULT_SITE_CONTENT } from "@/config/siteConfig";
import type { SiteContent } from "@/types/siteContent";

interface SiteContentContextValue {
  content: SiteContent;
  isLoading: boolean;
  refresh: () => void;
}

const SiteContentContext = createContext<SiteContentContextValue | null>(null);

function mergeWithDefaults(partial: Record<string, unknown>): SiteContent {
  return {
    contact: { ...DEFAULT_SITE_CONTENT.contact, ...(partial.contact as object) },
    social: { ...DEFAULT_SITE_CONTENT.social, ...(partial.social as object) },
    about: { ...DEFAULT_SITE_CONTENT.about, ...(partial.about as object) },
  };
}

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getSiteContent()
      .then((data) => {
        if (!cancelled) setContent(mergeWithDefaults(data));
      })
      .catch(() => {
        // Network or server error — keep showing DEFAULT_SITE_CONTENT rather
        // than an empty/broken page. Not surfaced as a form-style error
        // since this isn't a user action; it's just the site's own copy.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <SiteContentContext.Provider
      value={{ content, isLoading, refresh: () => setRefreshKey((k) => k + 1) }}
    >
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent(): SiteContentContextValue {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error("useSiteContent must be used within a SiteContentProvider.");
  }
  return context;
}
