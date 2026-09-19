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

export interface SiteContent {
  contact: ContactContent;
  social: SocialContent;
  about: AboutContent;
  seo: SeoContent;
}

export type SiteContentKey = keyof SiteContent;
