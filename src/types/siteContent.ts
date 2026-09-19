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

export interface SiteContent {
  contact: ContactContent;
  social: SocialContent;
  about: AboutContent;
  seo: SeoContent;
  hero: HeroContent;
  services: ServicesContent;
  journey: JourneyContent;
  whyChooseUs: WhyChooseUsContent;
}

export type SiteContentKey = keyof SiteContent;
