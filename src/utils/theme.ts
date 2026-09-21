import type { ThemeContent, ThemeName } from "@/types/siteContent";

/** What a visitor picked with the header switch. null = never touched it. */
export type VisitorChoice = "light" | "dark" | null;

export const THEME_NAMES: ThemeName[] = ["classic", "ocean", "warm", "dark"];

export const THEME_LABELS: Record<ThemeName, string> = {
  classic: "Classic — the original bright look",
  ocean: "Ocean — cool blue-tinted whites",
  warm: "Warm — soft cream and sand",
  dark: "Dark — deep navy with light text",
};

/**
 * Decides which theme to show. Order of priority:
 *  1. the visitor's own light/dark choice (if the switch is enabled),
 *  2. dark mode when their device asks for it (if that option is enabled),
 *  3. the admin's chosen theme.
 * "Light" means the admin's theme — or Classic when the admin's theme is itself dark.
 * This exact logic is repeated in index.html so the right theme paints before React loads.
 */
export function resolveTheme(config: ThemeContent, choice: VisitorChoice, deviceDark: boolean): ThemeName {
  const base = THEME_NAMES.includes(config.defaultTheme) ? config.defaultTheme : "classic";
  if (!config.allowVisitorSwitch) return base;
  if (choice === "dark") return "dark";
  if (choice === "light") return base === "dark" ? "classic" : base;
  if (config.followDeviceDarkMode && deviceDark) return "dark";
  return base;
}
