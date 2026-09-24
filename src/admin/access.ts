/**
 * Module access in the browser. Mirrors server/src/access/modules.ts (the
 * server enforces; this only decides what to show). Keep the keys in step.
 */
export const LEVELS = ["none", "view", "edit", "manage"] as const;
export type Level = (typeof LEVELS)[number];

export const MODULE_KEYS = ["sales", "hire", "imports", "finance", "customers", "marketing", "ai", "insights", "hr", "system", "tracking"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type AccessMap = Record<ModuleKey, Level>;

export const LEVEL_LABELS: Record<Level, string> = {
  none: "No access",
  view: "View",
  edit: "Edit",
  manage: "Manage",
};

export const LEVEL_HELP: Record<Level, string> = {
  none: "Hidden",
  view: "Can open and read",
  edit: "Can add, change and handle work",
  manage: "Edit, plus exports, settings and sensitive tools",
};

export function atLeast(have: Level | undefined, need: Level): boolean {
  return LEVELS.indexOf(have ?? "none") >= LEVELS.indexOf(need);
}
