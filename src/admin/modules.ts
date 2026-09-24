/**
 * The staff workspace's map: every module (department area), its pages, and
 * what access each page needs. One list drives the sidebar, the tabs at the top
 * of each page, the routes (see routes/AppRoutes.tsx), the module dashboards
 * and link prefetching — so adding a page means adding one line here.
 *
 * Pages load on demand. Hovering or focusing a link starts downloading that
 * page (`prefetch`), so it usually opens instantly.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Level, ModuleKey } from "./access";

type Loader = () => Promise<{ default: ComponentType }>;

export interface PageDef {
  path: string;
  label: string;
  /** Access needed to see this page (default "view" on its module). */
  level?: Level;
  /** Only the system administrator. */
  systemAdminOnly?: boolean;
  /** Short line for dashboards. */
  description?: string;
  load: Loader;
  /** Not listed in the sidebar or tabs (detail pages). */
  hidden?: boolean;
}

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  icon: IconName;
  description: string;
  pages: PageDef[];
}

export type IconName =
  | "home" | "car" | "key" | "ship" | "wallet" | "chat" | "megaphone" | "sparkle" | "chart" | "people" | "shield" | "user" | "undo" | "book";

/** 24×24 outline icons (stroke paths). */
export const ICONS: Record<IconName, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h5v-5h3v5h5V10",
  car: "M5 16h14M6.5 16v2.5M17.5 16v2.5M4 16v-4l2-5h12l2 5v4M6 12h12M8 14h.01M16 14h.01",
  key: "M14.5 9.5a3.5 3.5 0 1 1-1 2.45L4 21.5l-1-1 1.5-1.5L3 17.5l1.5-1.5L6 17.5l3.5-3.5",
  ship: "M3 17l1.5 3h15L21 17M5 17V11h14v6M8 11V6h8v5M12 3v3",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7l11-3v3M16 13.5h.01",
  chat: "M4 5h16v11H9l-5 4z M8 9.5h8M8 12.5h5",
  megaphone: "M4 10v4h3l7 4V6l-7 4zM17.5 9.5a3 3 0 0 1 0 5M7 14l1.5 5",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  chart: "M4 20h16M7 16v-5M12 16V7M17 16v-8",
  people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19a5.5 5.5 0 0 1 11 0M16 11a2.5 2.5 0 1 0 0-5M17.5 19H21a4.5 4.5 0 0 0-4.5-4.5",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
  undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
  book: "M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h11",
};

const page = (path: string, label: string, load: Loader, extra: Partial<PageDef> = {}): PageDef => ({ path, label, load, ...extra });

// Every page component, loaded only when first opened.
const L = {
  dashboard: () => import("./pages/AdminDashboard"),
  moduleHome: () => import("./pages/ModuleHome"),
  vehicles: () => import("./pages/AdminVehicles"),
  inquiries: () => import("./pages/requests/SalesInquiries"),
  deals: () => import("./pages/AdminDeals"),
  hireVehicles: () => import("./pages/AdminHireVehicles"),
  bookings: () => import("./pages/AdminBookings"),
  bookingDetail: () => import("./pages/AdminBookingDetail"),
  importRequests: () => import("./pages/requests/ImportClearingRequests"),
  shipments: () => import("./pages/AdminShipments"),
  purchases: () => import("./pages/purchases/AdminPurchases"),
  purchaseDetail: () => import("./pages/purchases/AdminPurchaseDetail"),
  customerAccounts: () => import("./pages/purchases/AdminCustomerAccounts"),
  customerStatement: () => import("./pages/purchases/AdminCustomerStatement"),
  payments: () => import("./pages/AdminPayments"),
  mobilePayments: () => import("./pages/AdminMobilePayments"),
  referrals: () => import("./pages/AdminReferrals"),
  pricing: () => import("./pages/AdminPricing"),
  contactMessages: () => import("./pages/requests/ContactMessages"),
  shipmentLookup: () => import("./pages/requests/ShipmentLookup"),
  reviews: () => import("./pages/AdminReviews"),
  siteContent: () => import("./pages/AdminSiteContent"),
  notices: () => import("./pages/AdminNotices"),
  testimonials: () => import("./pages/AdminTestimonials"),
  faq: () => import("./pages/AdminFaq"),
  blog: () => import("./pages/AdminBlogPosts"),
  social: () => import("./pages/AdminSocial"),
  lycie: () => import("./pages/AdminLycie"),
  insights: () => import("./pages/AdminInsights"),
  people: () => import("./pages/AdminPeople"),
  leave: () => import("./pages/AdminLeave"),
  activity: () => import("./pages/AdminActivity"),
  systemStatus: () => import("./pages/AdminSystemStatus"),
  guides: () => import("./pages/AdminGuides"),
  security: () => import("./pages/AdminSecurity"),
  myAccount: () => import("./pages/MyAccount"),
  directory: () => import("./pages/StaffDirectory"),
  allRequests: () => import("./pages/AdminRequests"),
};

/** Pages everyone signed in gets, whatever their department. */
export const WORKSPACE_PAGES: PageDef[] = [
  page("/admin", "Home", L.dashboard, { description: "Your dashboard" }),
  page("/admin/me", "My work & leave", L.myAccount, { description: "Your profile and leave requests" }),
  page("/admin/directory", "Team directory", L.directory, { description: "Colleagues and how to reach them" }),
  page("/admin/security", "My security", L.security, { description: "Password, two-step sign-in, devices" }),
  page("/admin/activity", "Activity & undo", L.activity, { description: "What changed, and undo mistakes" }),
];

export const MODULES: ModuleDef[] = [
  {
    key: "sales",
    label: "Sales",
    icon: "car",
    description: "Vehicles for sale, inquiries and deals",
    pages: [
      page("/admin/vehicles", "Vehicles", L.vehicles, { description: "Add, edit and publish vehicles for sale" }),
      page("/admin/inquiries", "Inquiries", L.inquiries, { description: "Questions about vehicles" }),
      page("/admin/deals", "Deals & market", L.deals, { description: "Promotions and the AI deals finder" }),
    ],
  },
  {
    key: "hire",
    label: "Hire & Fleet",
    icon: "key",
    description: "Hire vehicles and bookings",
    pages: [
      page("/admin/bookings", "Bookings", L.bookings, { description: "Requests, confirmed hires and returns" }),
      page("/admin/hire-vehicles", "Hire vehicles", L.hireVehicles, { description: "The fleet, photos and rates" }),
      page("/admin/bookings/:id", "Booking", L.bookingDetail, { hidden: true }),
    ],
  },
  {
    key: "imports",
    label: "Imports & Clearing",
    icon: "ship",
    description: "Requests and shipment tracking",
    pages: [
      page("/admin/shipments", "Shipments", L.shipments, { description: "Track vehicles from purchase to delivery" }),
      page("/admin/import-requests", "Requests", L.importRequests, { description: "Import and clearing requests" }),
    ],
  },
  {
    key: "finance",
    label: "Finance",
    icon: "wallet",
    description: "Sales, balances, payments, mobile money, referrals and prices",
    pages: [
      page("/admin/purchases", "Sales & balances", L.purchases, { description: "What customers bought, paid and still owe" }),
      page("/admin/customer-accounts", "Customer accounts", L.customerAccounts, { description: "Each customer's purchases, payments and statement" }),
      page("/admin/purchases/:id", "Purchase", L.purchaseDetail, { hidden: true }),
      page("/admin/customer-accounts/:customerId", "Customer statement", L.customerStatement, { hidden: true }),
      page("/admin/payments", "Payment proofs", L.payments, { description: "Approve customers' payment proofs" }),
      page("/admin/mobile-payments", "Mobile money", L.mobilePayments, { description: "Airtel Money & TNM Mpamba payments" }),
      page("/admin/referrals", "Referrals", L.referrals, { description: "Reward customers who bring friends" }),
      page("/admin/pricing", "Prices & currency", L.pricing, { description: "Exchange rate and price display" }),
    ],
  },
  {
    key: "customers",
    label: "Customer Care",
    icon: "chat",
    description: "Messages and reviews",
    pages: [
      page("/admin/messages", "Contact messages", L.contactMessages, { description: "Messages from the contact form" }),
      page("/admin/reviews", "Reviews", L.reviews, { description: "Approve customer reviews" }),
      page("/admin/shipment-lookup", "Look up a shipment", L.shipmentLookup, { description: "A customer's shipment status, by their tracking code" }),
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Content",
    icon: "megaphone",
    description: "The website, notices and social media",
    pages: [
      page("/admin/site-content", "Website content", L.siteContent, { description: "Every text and section on the site" }),
      page("/admin/notices", "Notices", L.notices, { description: "Banners and pop-ups" }),
      page("/admin/testimonials", "Testimonials", L.testimonials),
      page("/admin/faq", "FAQ", L.faq),
      page("/admin/blog", "Blog", L.blog),
      page("/admin/social", "Social media", L.social, { description: "Post to Facebook & Instagram" }),
    ],
  },
  {
    key: "ai",
    label: "Lycie AI",
    icon: "sparkle",
    description: "The assistant's knowledge",
    pages: [page("/admin/lycie", "Lycie AI", L.lycie, { description: "Knowledge, documents and drafted FAQs" })],
  },
  {
    key: "insights",
    label: "Insights",
    icon: "chart",
    description: "Demand, sentiment and recommendations",
    pages: [page("/admin/insights", "Insights", L.insights, { description: "What customers want and think" })],
  },
  {
    key: "hr",
    label: "People (HR)",
    icon: "people",
    description: "Staff, invitations and leave",
    pages: [
      page("/admin/people", "Staff", L.people, { description: "Invite staff and keep profiles up to date" }),
      page("/admin/leave", "Leave", L.leave, { description: "Approve leave, see who's away" }),
    ],
  },
  {
    key: "system",
    label: "System",
    icon: "shield",
    description: "Access, security and the activity log",
    pages: [
      page("/admin/users", "Staff & access", L.people, { description: "Who can use which module", level: "manage" }),
      page("/admin/system", "Settings & status", L.systemStatus, { description: "Website language, security rules and connected services" }),
      page("/admin/guides", "Guides", L.guides, { description: "Write the page descriptions staff see, and choose who sees them", systemAdminOnly: true }),
    ],
  },
];

/** Older address kept working (all request types on one page). */
export const EXTRA_PAGES: PageDef[] = [page("/admin/requests", "All requests", L.allRequests, { hidden: true })];

/** Module dashboards live at /admin/m/<key>. */
export const MODULE_HOME = L.moduleHome;
export const moduleHomePath = (key: ModuleKey) => `/admin/m/${key}`;

const lazyCache = new Map<Loader, LazyExoticComponent<ComponentType>>();
/** One lazy component per loader (so the same page listed twice isn't downloaded twice). */
export function lazyPage(load: Loader): LazyExoticComponent<ComponentType> {
  let component = lazyCache.get(load);
  if (!component) {
    component = lazy(load);
    lazyCache.set(load, component);
  }
  return component;
}

const started = new Set<Loader>();
/** Starts downloading a page before it's clicked. */
export function prefetch(path: string): void {
  const all = [...WORKSPACE_PAGES, ...MODULES.flatMap((m) => m.pages), ...EXTRA_PAGES];
  const target = path.startsWith("/admin/m/") ? MODULE_HOME : all.find((p) => p.path === path.split("?")[0])?.load;
  if (target && !started.has(target)) {
    started.add(target);
    void target().catch(() => started.delete(target));
  }
}

/** Which module a page address belongs to (for tabs and the active sidebar group). */
export function moduleForPath(pathname: string): ModuleDef | undefined {
  if (pathname.startsWith("/admin/m/")) return MODULES.find((m) => m.key === pathname.split("/")[3]);
  return MODULES.find((m) =>
    m.pages.some((p) => {
      const pattern = new RegExp(`^${p.path.replace(/:[^/]+/g, "[^/]+")}$`);
      return pattern.test(pathname) || (!p.hidden && pathname.startsWith(`${p.path}/`));
    })
  );
}
