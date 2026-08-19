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

export interface SiteContent {
  contact: ContactContent;
  social: SocialContent;
  about: AboutContent;
}

export type SiteContentKey = keyof SiteContent;
