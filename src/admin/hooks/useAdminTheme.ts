/**
 * Light / dark / match-device theme for the staff workspace, remembered on this
 * device. It uses the same colour tokens as the public site's dark theme
 * (styles/variables.css), set on <html data-theme>. The public site's own theme
 * (ThemeContext) steps aside on /admin pages.
 */
import { useCallback, useEffect, useState } from "react";

export type AdminThemeMode = "light" | "dark" | "system";
const KEY = "lycie_admin_theme";

function readMode(): AdminThemeMode {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

export function useAdminTheme() {
  const [mode, setModeState] = useState<AdminThemeMode>(readMode);
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setDeviceDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const isDark = mode === "dark" || (mode === "system" && deviceDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    return () => root.removeAttribute("data-theme");
  }, [isDark]);

  const setMode = useCallback((next: AdminThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered, but applies for now.
    }
  }, []);

  return { mode, isDark, setMode };
}
