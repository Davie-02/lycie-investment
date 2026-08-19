import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getActiveNotices } from "@/services/notices.service";
import type { Notice } from "@/types/notice";

interface NoticesContextValue {
  notices: Notice[];
  isLoading: boolean;
}

const NoticesContext = createContext<NoticesContextValue | null>(null);

export function NoticesProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getActiveNotices()
      .then((data) => {
        if (!cancelled) setNotices(data);
      })
      .catch(() => {
        // If notices can't be fetched, the site should still work — just
        // show no banners/popups rather than breaking the page.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NoticesContext.Provider value={{ notices, isLoading }}>{children}</NoticesContext.Provider>
  );
}

export function useNotices(): NoticesContextValue {
  const context = useContext(NoticesContext);
  if (!context) {
    throw new Error("useNotices must be used within a NoticesProvider.");
  }
  return context;
}
