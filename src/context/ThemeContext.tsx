import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useSiteContent } from "@/context/SiteContentContext";
import { resolveTheme, type VisitorChoice } from "@/utils/theme";
import type { ThemeName } from "@/types/siteContent";

interface ThemeContextValue {
  theme: ThemeName;
  isDark: boolean;
  /** Whether to show the light/dark switch (the admin can turn it off). */
  canSwitch: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const CHOICE_KEY = "lycie_theme_choice";
/** The admin's theme settings, cached so the very next page load can paint the right theme instantly (see index.html). */
const CONFIG_KEY = "lycie_site_theme_cfg";

/** The colour shown in a phone's browser bar. Brand navy for every theme, so the brand stays constant. */
const THEME_COLOR = "#19406c";

function readChoice(): VisitorChoice {
  try {
    const stored = localStorage.getItem(CHOICE_KEY);
    return stored === "dark" || stored === "light" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Applies the site theme by setting <html data-theme="…"> (the colours themselves live in
 * styles/variables.css). The admin dashboard is deliberately always Classic — themes are for the
 * public site — so no theme is applied on /admin pages.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { content } = useSiteContent();
  const location = useLocation();
  const [choice, setChoice] = useState<VisitorChoice>(readChoice);
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setDeviceDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = resolveTheme(content.theme, choice, deviceDark);
  const inAdmin = location.pathname.startsWith("/admin");

  useEffect(() => {
    const root = document.documentElement;
    if (inAdmin || theme === "classic") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR);
  }, [theme, inAdmin]);

  // Remember the admin's settings for the next visit's first paint.
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(content.theme));
    } catch {
      // Storage blocked: the theme just appears a moment after load instead.
    }
  }, [content.theme]);

  const toggleDark = useCallback(() => {
    const next: VisitorChoice = theme === "dark" ? "light" : "dark";
    setChoice(next);
    try {
      localStorage.setItem(CHOICE_KEY, next as string);
    } catch {
      // Not remembered across visits, but works for this one.
    }
  }, [theme]);

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", canSwitch: content.theme.allowVisitorSwitch, toggleDark }),
    [theme, content.theme.allowVisitorSwitch, toggleDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider.");
  return context;
}
