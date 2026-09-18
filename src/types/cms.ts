export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string | null;
  rating: number;
  isFeatured: boolean;
  authorPhotoUrl: string | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImageUrl: string | null;
  coverAlt: string | null;
  publishedAt: string | null;
}

export interface SeoSettings {
  siteName: string;
  defaultDescription: string | null;
  facebookAppId: string | null;
  googleAnalyticsId: string | null;
}
