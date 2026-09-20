export interface ContactContent {
  phone: string;
  email: string;
  address: string;
  businessHours: string;
  whatsappNumber: string | null;
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
