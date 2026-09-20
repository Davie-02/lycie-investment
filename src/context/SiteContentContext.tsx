import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSiteContent } from "@/services/siteContent.service";
import { subscribeLive } from "@/services/liveContent";
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
    company: { ...DEFAULT_SITE_CONTENT.company, ...(partial.company as object) },
    team: { ...DEFAULT_SITE_CONTENT.team, ...(partial.team as object) },
    clients: { ...DEFAULT_SITE_CONTENT.clients, ...(partial.clients as object) },
    fleet: { ...DEFAULT_SITE_CONTENT.fleet, ...(partial.fleet as object) },
    contact: { ...DEFAULT_SITE_CONTENT.contact, ...(partial.contact as object) },
    social: { ...DEFAULT_SITE_CONTENT.social, ...(partial.social as object) },
    about: { ...DEFAULT_SITE_CONTENT.about, ...(partial.about as object) },
    seo: { ...DEFAULT_SITE_CONTENT.seo, ...(partial.seo as object) },
    hero: { ...DEFAULT_SITE_CONTENT.hero, ...(partial.hero as object) },
    services: { ...DEFAULT_SITE_CONTENT.services, ...(partial.services as object) },
    journey: { ...DEFAULT_SITE_CONTENT.journey, ...(partial.journey as object) },
    whyChooseUs: { ...DEFAULT_SITE_CONTENT.whyChooseUs, ...(partial.whyChooseUs as object) },
    importPage: { ...DEFAULT_SITE_CONTENT.importPage, ...(partial.importPage as object) },
    clearingPage: { ...DEFAULT_SITE_CONTENT.clearingPage, ...(partial.clearingPage as object) },
    hirePage: { ...DEFAULT_SITE_CONTENT.hirePage, ...(partial.hirePage as object) },
  };
}

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Only the first load shows a loading state; live refreshes swap content silently.
    if (refreshKey === 0) setIsLoading(true);

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

  // Text edited in the admin (contact details, hero, about…) updates every open page.
  useEffect(() => subscribeLive(["site-content"], () => setRefreshKey((k) => k + 1)), []);

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
