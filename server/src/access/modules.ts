/**
 * The company's modules (areas of work), departments, and who can do what.
 *
 * Access is per module at one of four levels:
 *   none   – the module is hidden
 *   view   – can open and read it
 *   edit   – can add, change and handle work in it
 *   manage – edit, plus the module's sensitive tools (exports, settings, inviting staff in HR)
 *
 * A staff member's access = their department's defaults, then any per-person
 * overrides a system administrator set ("extend" or "limit"). The system
 * administrator (role OWNER) always has everything.
 *
 * The same list is mirrored for the browser in src/admin/modules.ts — keep the keys in step.
 */

export const LEVELS = ["none", "view", "edit", "manage"] as const;
export type Level = (typeof LEVELS)[number];

export const MODULE_KEYS = ["sales", "hire", "imports", "finance", "customers", "marketing", "ai", "insights", "hr", "system"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleInfo {
  key: ModuleKey;
  label: string;
  description: string;
}

export const MODULES: ModuleInfo[] = [
  { key: "sales", label: "Sales", description: "Vehicles for sale, vehicle inquiries and deals" },
  { key: "hire", label: "Hire & Fleet", description: "Hire vehicles, bookings and availability" },
  { key: "imports", label: "Imports & Clearing", description: "Import and clearing requests, shipment tracking" },
  { key: "finance", label: "Finance", description: "Payments, mobile money, referral rewards, prices and currency" },
  { key: "customers", label: "Customer Care", description: "Contact messages, messaging customers, reviews" },
  { key: "marketing", label: "Marketing & Content", description: "Website content, notices, testimonials, FAQ, blog, social media" },
  { key: "ai", label: "Lycie AI", description: "The assistant's knowledge, documents, drafted FAQs and AI writer" },
  { key: "insights", label: "Insights & Market", description: "Analytics, customer demand and market briefings" },
  { key: "hr", label: "People (HR)", description: "Staff directory, inviting staff, leave requests" },
  { key: "system", label: "System", description: "Staff accounts and access, activity log, security" },
];

export const DEPARTMENTS: Record<string, { label: string; access: Partial<Record<ModuleKey, Level>> }> = {
  management: {
    label: "Management",
    access: { sales: "edit", hire: "edit", imports: "edit", finance: "edit", customers: "edit", marketing: "edit", ai: "edit", insights: "view", hr: "view" },
  },
  sales: { label: "Sales", access: { sales: "edit", customers: "edit", hire: "view", ai: "view", insights: "view" } },
  hire: { label: "Hire & Fleet", access: { hire: "edit", customers: "view", insights: "view" } },
  imports: { label: "Imports & Clearing", access: { imports: "edit", customers: "view", sales: "view" } },
  finance: { label: "Finance", access: { finance: "edit", sales: "view", hire: "view", imports: "view", insights: "view" } },
  customer_care: { label: "Customer Care", access: { customers: "edit", sales: "view", hire: "view", imports: "view", ai: "edit" } },
  marketing: { label: "Marketing", access: { marketing: "edit", ai: "edit", sales: "view", insights: "view" } },
  hr: { label: "Human Resources", access: { hr: "manage" } },
  general: { label: "General staff", access: {} },
};

const rank = (level: Level) => LEVELS.indexOf(level);
export const atLeast = (have: Level | undefined, need: Level) => rank(have ?? "none") >= rank(need);

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value);
}

export type AccessMap = Record<ModuleKey, Level>;

function empty(): AccessMap {
  return Object.fromEntries(MODULE_KEYS.map((key) => [key, "none"])) as AccessMap;
}

/** Keeps only valid "module: level" pairs from stored overrides (the column is free-form JSON). */
export function cleanOverrides(raw: unknown): Partial<Record<ModuleKey, Level>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<ModuleKey, Level>> = {};
  for (const [key, value] of Object.entries(raw)) if (isModuleKey(key) && isLevel(value)) out[key] = value;
  return out;
}

/** The defaults an account gets before overrides: by role (legacy accounts) or by department (employees). */
export function baseAccess(role: string, department: string | null | undefined): AccessMap {
  const map = empty();
  if (role === "OWNER") return Object.fromEntries(MODULE_KEYS.map((key) => [key, "manage"])) as AccessMap;
  if (role === "MANAGER") Object.assign(map, DEPARTMENTS.management.access);
  else if (role === "VIEWER") Object.assign(map, { sales: "view", hire: "view", imports: "view", customers: "view" });
  if (department && DEPARTMENTS[department]) {
    // Department defaults add to (never shrink) the role's own; overrides below can shrink.
    for (const [key, level] of Object.entries(DEPARTMENTS[department].access) as Array<[ModuleKey, Level]>) {
      if (rank(level) > rank(map[key])) map[key] = level;
    }
  }
  return map;
}

/** Final access: defaults, then the system administrator's per-person overrides. Owners always get everything. */
export function effectiveAccess(role: string, department: string | null | undefined, overrides: unknown): AccessMap {
  const map = baseAccess(role, department);
  if (role === "OWNER") return map;
  return { ...map, ...cleanOverrides(overrides) };
}
