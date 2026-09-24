/**
 * English / Chichewa for the public website. Administrators decide (System →
 * Site settings) whether visitors may switch and which language is the
 * default. A visitor's own choice is remembered on the device, but only
 * counts while switching is allowed. Sets <html lang> for screen readers.
 *
 * No flash on refresh: the page starts before the site's settings arrive, so
 * the last known setting is remembered on the device and used until then.
 * With nothing remembered (first visit), the switch stays hidden until the
 * real setting is known, so it can never appear when it has been turned off.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type StringKey } from "./strings";
import { useSiteContent } from "@/context/SiteContentContext";
import type { LanguageContent } from "@/types/siteContent";

const KEY = "lycie_lang";
/** The administrators' language setting as last seen, for the next page load's first moment. */
const SETTING_KEY = "lycie_lang_setting";

/**
 * Which language setting applies right now. Until the site's settings have
 * actually arrived (also if the server can't be reached): the remembered one, or — first visit — the default language with no
 * switch, so a switch that has been turned off never flashes on screen.
 */
export function effectiveLanguageSetting(hasLoaded: boolean, saved: LanguageContent | null, loaded: LanguageContent): LanguageContent {
  if (hasLoaded) return loaded;
  return saved ?? { ...loaded, allowVisitorSwitch: false };
}

function readSavedSetting(): LanguageContent | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTING_KEY) ?? "null") as Partial<LanguageContent> | null;
    if (!parsed || typeof parsed.allowVisitorSwitch !== "boolean") return null;
    return { allowVisitorSwitch: parsed.allowVisitorSwitch, defaultLanguage: parsed.defaultLanguage === "ny" ? "ny" : "en" };
  } catch {
    return null;
  }
}

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
  const { content, hasLoaded } = useSiteContent();
  const [saved] = useState<LanguageContent | null>(readSavedSetting);
  const setting = effectiveLanguageSetting(hasLoaded, saved, content.language);
  const [choice, setChoice] = useState<Lang | null>(readLang);

  useEffect(() => {
    if (!hasLoaded) return;
    try {
      localStorage.setItem(SETTING_KEY, JSON.stringify(content.language));
    } catch {
      // Not remembered; the switch just waits for the settings on the next visit.
    }
  }, [hasLoaded, content.language]);
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
