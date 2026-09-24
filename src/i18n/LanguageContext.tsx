/**
 * English / Chichewa for the public website. Administrators decide (System →
 * Site settings) whether visitors may switch and which language is the
 * default. A visitor's own choice is remembered on the device, but only
 * counts while switching is allowed. Sets <html lang> for screen readers.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type StringKey } from "./strings";
import { useSiteContent } from "@/context/SiteContentContext";

const KEY = "lycie_lang";

interface LanguageValue {
  lang: Lang;
  /** Whether the header switch is shown (an administrator can turn it off). */
  canSwitch: boolean;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
}

function readLang(): Lang | null {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "ny" || stored === "en" ? stored : null;
  } catch {
    return null;
  }
}

const LanguageContext = createContext<LanguageValue>({ lang: "en", canSwitch: false, setLang: () => undefined, t: (key) => STRINGS.en[key] });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { content } = useSiteContent();
  const setting = content.language;
  const [choice, setChoice] = useState<Lang | null>(readLang);
  const fallback: Lang = setting.defaultLanguage === "ny" ? "ny" : "en";
  const lang: Lang = setting.allowVisitorSwitch ? choice ?? fallback : fallback;

  useEffect(() => {
    document.documentElement.lang = lang === "ny" ? "ny" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, but applies now.
    }
  }, []);

  const value = useMemo(
    () => ({ lang, canSwitch: setting.allowVisitorSwitch, setLang, t: (key: StringKey) => STRINGS[lang][key] ?? STRINGS.en[key] }),
    [lang, setting.allowVisitorSwitch, setLang]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}

export function useT(): LanguageValue["t"] {
  return useContext(LanguageContext).t;
}
