export interface ContactContent {
  phone: string;
  email: string;
  address: string;
  businessHours: string;
  whatsappNumber: string | null;
  /**
   * What the map shows: a street address, a place name ("Lilongwe City Mall"),
   * or coordinates ("-13.9626, 33.7741"). Blank = use `address`. If both are
   * blank the map is hidden.
   */
  mapQuery: string | null;
}

export interface ImportOrigin {
  name: string;
  /** Typical shipping cost to Malawi for one vehicle from this country, in US dollars. */
  shippingUsd: number;
}

/**
 * The public "Import cost estimator" on the Import page. Off until an admin has checked the rates and
 * switched it on — the default numbers are placeholders, not real duty rates.
 */
export interface ImportCalculatorContent {
  enabled: boolean;
  heading: string;
  intro: string;
  disclaimer: string;
  origins: ImportOrigin[];
  /** Import duty as a percent of the vehicle price plus shipping. */
  dutyPercent: number;
  /** VAT and similar taxes as a percent of (vehicle + shipping + duty). */
  vatPercent: number;
  /** Flat clearing and documentation fee, in US dollars. */
  clearingFeeUsd: number;
  /** The company's service fee as a percent of the vehicle price. */
  serviceFeePercent: number;
  /** Delivery inside Malawi, in US dollars. */
  deliveryUsd: number;
}

export type ThemeName = "classic" | "ocean" | "warm" | "dark";

/**
 * How the public site looks. Every theme keeps the brand navy and sky blue, the logo, and the
 * header/footer/button colours; only surface tones (page background, cards, borders) change.
 */
export interface ThemeContent {
  defaultTheme: ThemeName;
  /** Show a light/dark switch in the header so visitors can choose for themselves. */
  allowVisitorSwitch: boolean;
  /** Start in dark mode for visitors whose device is set to dark mode (only if the switch is on). */
  followDeviceDarkMode: boolean;
}

/** Footer texts. The year and company name in the copyright line are added automatically. */
export interface FooterContent {
  tagline: string;
  /** Shown after "© 2026 Lycie Investments." e.g. "All rights reserved." */
  rightsText: string;
}

/** The big title and intro line at the top of a page. */
export interface PageHeading {
  heading: string;
  body: string;
}

/** Top-of-page headings for the pages that have no editor of their own. */
export interface PageHeadingsContent {
  vehicles: PageHeading;
  contact: PageHeading;
  faq: PageHeading;
  blog: PageHeading;
  reviews: PageHeading;
  login: PageHeading;
  register: PageHeading;
}

export interface SectionIntro {
  eyebrow: string;
  heading: string;
}

/** Headings of the homepage sections whose content comes from elsewhere (FAQ list, testimonials) plus the closing call-to-action. */
export interface HomeSectionsContent {
  faq: SectionIntro;
  testimonials: SectionIntro;
  contactCards: SectionIntro & { body: string };
  cta: { heading: string; body: string; primaryLabel: string; secondaryLabel: string };
}

export interface SocialContent {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
}

export interface AboutContent {
  intro: string;
  whatWeDo: string;
  howWeWork: string;
  whyChooseUs: string;
}

export interface SeoContent {
  siteName: string;
  defaultDescription: string;
  facebookAppId: string | null;
  /** Picture shown when a page is shared (Facebook, WhatsApp, X…) and in some search results. */
  ogImage: string | null;
  /** e.g. @lycieinvestments — used for X (Twitter) cards. */
  twitterHandle: string | null;
  /** The code Google Search Console gives to prove you own the site. */
  googleVerification: string | null;
  /** The code Bing Webmaster Tools gives to prove you own the site. */
  bingVerification: string | null;
}

export interface HeroHighlight {
  label: string;
  title: string;
  detail: string;
  origin: string;
  destination: string;
}

export interface HeroContent {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  highlights: HeroHighlight[];
}

export interface ServiceItem {
  title: string;
  description: string;
}

/// items[] is a fixed 4 slots, in order: Importing, Dealership, Hire,
/// Clearing — the icon and link target for each slot are set in code
/// (ServicesSection.tsx), only the title/description text is CMS-edited.
export interface ServicesContent {
  eyebrow: string;
  heading: string;
  body: string;
  items: ServiceItem[];
}

export interface JourneyStep {
  title: string;
  detail: string;
}

export interface JourneyContent {
  eyebrow: string;
  heading: string;
  body: string;
  steps: JourneyStep[];
}

export interface WhyChooseUsItem {
  title: string;
  detail: string;
}

export interface WhyChooseUsContent {
  eyebrow: string;
  heading: string;
  items: WhyChooseUsItem[];
}

export interface ServicePageContent {
  heading: string;
  body: string;
}

export interface ClearingPageContent extends ServicePageContent {
  disclaimer: string;
  areas: string[];
}

export interface CompanyValue {
  title: string;
  detail: string;
}

/** Who the company is: story, vision, mission and values. Empty until content is added. */
export interface CompanyContent {
  name: string;
  established: number | null;
  tagline: string;
  story: string[];
  vision: string;
  mission: string;
  missionPoints: string[];
  values: CompanyValue[];
}

export interface TeamMember {
  name: string;
  role: string;
  photoUrl?: string;
}

export interface TeamGroup {
  title: string;
  members: TeamMember[];
}

export interface TeamContent {
  eyebrow: string;
  heading: string;
  body: string;
  groups: TeamGroup[];
}

export interface ClientItem {
  title: string;
  detail: string;
}

export interface ClientsContent {
  eyebrow: string;
  heading: string;
  body: string;
  items: ClientItem[];
}

export interface FleetItem {
  title: string;
  caption: string;
  image?: string;
}

export interface FleetContent {
  eyebrow: string;
  heading: string;
  body: string;
  items: FleetItem[];
}

export interface SiteContent {
  company: CompanyContent;
  team: TeamContent;
  clients: ClientsContent;
  fleet: FleetContent;
  contact: ContactContent;
  footer: FooterContent;
  theme: ThemeContent;
  importCalculator: ImportCalculatorContent;
  pageHeadings: PageHeadingsContent;
  homeSections: HomeSectionsContent;
  social: SocialContent;
  about: AboutContent;
  seo: SeoContent;
  hero: HeroContent;
  services: ServicesContent;
  journey: JourneyContent;
  whyChooseUs: WhyChooseUsContent;
  importPage: ServicePageContent;
  clearingPage: ClearingPageContent;
  hirePage: ServicePageContent;
}

export type SiteContentKey = keyof SiteContent;
