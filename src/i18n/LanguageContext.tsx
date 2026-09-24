/**
 * English / Chichewa switch for the public website. The choice is remembered
 * on the device and sets <html lang>, so screen readers pronounce it right.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STRINGS, type Lang, type StringKey } from "./strings";

const KEY = "lycie_lang";

interface LanguageValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: StringKey) => string;
}

function readLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "ny" ? "ny" : "en";
  } catch {
    return "en";
  }
}

const LanguageContext = createContext<LanguageValue>({ lang: "en", setLang: () => undefined, t: (key) => STRINGS.en[key] });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  useEffect(() => {
    document.documentElement.lang = lang === "ny" ? "ny" : "en";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, but applies now.
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: (key: StringKey) => STRINGS[lang][key] ?? STRINGS.en[key] }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageValue {
  return useContext(LanguageContext);
}

export function useT(): LanguageValue["t"] {
  return useContext(LanguageContext).t;
}
