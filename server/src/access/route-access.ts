/**
 * Which module (and level) each staff API route needs. RolesGuard consults
 * this for every staff request, so access is enforced in ONE place rather than
 * by role lists scattered across controllers.
 *
 * Default level: reading (GET) needs "view", anything that changes data needs
 * "edit". Rules can ask for "manage" (personal-data exports, settings).
 */
import type { Level, ModuleKey } from "./modules";

export type RouteAccess =
  /** Any signed-in staff member (their own account, the dashboard, directory…). */
  | { kind: "staff" }
  /** At least `level` in ANY of these modules (shared tools like image upload or the AI writer). */
  | { kind: "modules"; modules: ModuleKey[]; level: Level };

const CONTENT_TYPE_MODULE: Record<string, ModuleKey> = {
  vehicles: "sales",
  "hire-vehicles": "hire",
  testimonials: "marketing",
  faq: "marketing",
  "blog-posts": "marketing",
  notices: "marketing",
};

const EXPORT_MODULE: Record<string, ModuleKey> = {
  inquiries: "sales",
  "import-requests": "imports",
  "clearing-requests": "imports",
  "hire-requests": "hire",
  "contact-messages": "customers",
  reviews: "customers",
};

type Rule = [RegExp, (m: RegExpMatchArray, write: boolean) => RouteAccess | null];

const one = (module: ModuleKey, write: boolean, level?: Level): RouteAccess => ({
  kind: "modules",
  modules: [module],
  level: level ?? (write ? "edit" : "view"),
});
const any = (modules: ModuleKey[], write: boolean, level?: Level): RouteAccess => ({ kind: "modules", modules, level: level ?? (write ? "edit" : "view") });
const STAFF: RouteAccess = { kind: "staff" };

// First match wins, so specific rules come before general ones.
const RULES: Rule[] = [
  [/^\/auth(\/|$)/, () => STAFF],
  [/^\/workspace(\/|$)/, () => STAFF],
  [/^\/admin-tools\/(overview|search)$/, () => STAFF],
  [/^\/admin-tools\/activity(\/|$)/, () => STAFF],
  [/^\/admin-tools\/system-status$/, () => one("system", false)],
  [/^\/admin-tools\/export\/([^/]+)$/, (m) => (EXPORT_MODULE[m[1]] ? one(EXPORT_MODULE[m[1]], true, "manage") : null)],
  [/^\/hr\/directory$/, () => STAFF],
  [/^\/hr\/leave\/me(\/|$)/, () => STAFF],
  [/^\/hr(\/|$)/, (_m, w) => one("hr", w)],
  // Staff accounts: HR or System. The service adds finer rules (only system admins set access or touch Owners).
  [/^\/admin-users(\/|$)/, (_m, w) => any(["system", "hr"], w, w ? "manage" : "view")],
  [/^\/content-admin\/([^/]+)/, (m, w) => (CONTENT_TYPE_MODULE[m[1]] ? one(CONTENT_TYPE_MODULE[m[1]], w) : null)],
  [/^\/uploads$/, (_m, w) => any(["sales", "hire", "imports", "marketing"], w)],
  [/^\/vehicles(\/|$)/, (_m, w) => one("sales", w)],
  [/^\/inquiries(\/|$)/, (_m, w) => one("sales", w)],
  [/^\/deal-admin(\/|$)/, (_m, w) => one("sales", w)],
  [/^\/hire-vehicles(\/|$)/, (_m, w) => one("hire", w)],
  [/^\/hire-requests(\/|$)/, (_m, w) => one("hire", w)],
  // Shipments: the full list (with every tracking code) is for people with the "tracking" privilege
  // (Director, Managers, or given by a system administrator). Everyone else looks a shipment up by
  // the code the customer gives them.
  [/^\/shipments\/lookup\/[^/]+$/, () => any(["imports", "customers"], false)],
  [/^\/shipments\/summary$/, () => any(["imports", "tracking"], false)],
  [/^\/shipments$/, (_m, w) => (w ? one("imports", true) : one("tracking", false))],
  [/^\/(import-requests|clearing-requests|customer-cases|shipments)(\/|$)/, (_m, w) => one("imports", w)],
  [/^\/customer-lookup$/, () => any(["imports", "finance", "customers", "sales", "hire"], false)],
  [/^\/financial\/payments(\/|$)/, (_m, w) => one("finance", w)],
  [/^\/mobile-payments(\/|$)/, (_m, w) => one("finance", w)],
  [/^\/referrals(\/|$)/, (_m, w) => one("finance", w)],
  [/^\/pricing\/convert-listings$/, () => one("finance", true, "manage")],
  [/^\/pricing(\/|$)/, (_m, w) => one("finance", w)],
  [/^\/contact-admin\/test-email$/, () => one("system", true, "manage")],
  [/^\/contact-admin\/email-status$/, () => any(["customers", "system"], false)],
  // Contacting a customer happens from every department's requests, so any of them may use it.
  [/^\/contact-admin(\/|$)/, (_m, w) => any(["customers", "sales", "hire", "imports"], w)],
  [/^\/(contact-messages|reviews)(\/|$)/, (_m, w) => one("customers", w)],
  [/^\/notifications\/status$/, () => any(["customers", "system"], false)],
  [/^\/site-content\/apply-profile$/, () => one("marketing", true, "manage")],
  // Whether visitors may switch language is a system setting, not a content edit.
  [/^\/site-content\/language$/, (_m, w) => one("system", w)],
  [/^\/(site-content|notices|testimonials|faq|blog-posts|social)(\/|$)/, (_m, w) => one("marketing", w)],
  [/^\/lycie\/write$/, (_m, w) => any(["marketing", "sales", "hire", "ai"], w)],
  [/^\/lycie(\/|$)/, (_m, w) => one("ai", w)],
  [/^\/(insights|market)(\/|$)/, (_m, w) => one("insights", w)],
  [/^\/alerts\/demand$/, () => one("insights", false)],
];

/** The access a staff route needs, or null when this table doesn't know the route (then the controller's role list decides). */
export function accessForRoute(method: string, path: string): RouteAccess | null {
  const route = path.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const write = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  for (const [pattern, resolve] of RULES) {
    const match = route.match(pattern);
    if (match) return resolve(match, write);
  }
  return null;
}
