import { Injectable } from "@nestjs/common";
import { StrapiClientService } from "./strapi-client.service";

interface StrapiMedia {
  url: string;
}

interface StrapiCollectionResponse<T> {
  data: T[];
}

interface StrapiSingleResponse<T> {
  data: T | null;
}

interface RawTestimonial {
  documentId: string;
  quote: string;
  authorName: string;
  authorTitle?: string;
  rating: number;
  isFeatured: boolean;
  authorPhoto?: StrapiMedia | null;
}

interface RawFaq {
  documentId: string;
  question: string;
  answer: string;
  category?: string;
  sortOrder: number;
}

interface RawBlogPost {
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string;
  body: string;
  seoTitle?: string;
  seoDescription?: string;
  coverImage?: StrapiMedia | null;
  coverAlt?: string;
  publishedAt?: string;
}

interface RawSeoSettings {
  siteName: string;
  defaultDescription?: string;
  facebookAppId?: string;
  googleAnalyticsId?: string;
}

@Injectable()
export class CmsService {
  constructor(private readonly strapi: StrapiClientService) {}

  async getTestimonials() {
    const res = await this.strapi.get<StrapiCollectionResponse<RawTestimonial>>(
      "/api/testimonials?populate=authorPhoto&sort=isFeatured:desc"
    );
    return (res?.data ?? []).map((t) => ({
      id: t.documentId,
      quote: t.quote,
      authorName: t.authorName,
      authorTitle: t.authorTitle ?? null,
      rating: t.rating,
      isFeatured: t.isFeatured,
      authorPhotoUrl: this.strapi.resolveMediaUrl(t.authorPhoto?.url),
    }));
  }

  async getFaqs() {
    const res = await this.strapi.get<StrapiCollectionResponse<RawFaq>>("/api/faqs?sort=sortOrder:asc");
    return (res?.data ?? []).map((f) => ({
      id: f.documentId,
      question: f.question,
      answer: f.answer,
      category: f.category ?? null,
    }));
  }

  async getBlogPosts() {
    const res = await this.strapi.get<StrapiCollectionResponse<RawBlogPost>>(
      "/api/blog-posts?populate=coverImage&sort=publishedAt:desc"
    );
    return (res?.data ?? []).map((p) => this.mapBlogPost(p));
  }

  async getBlogPostBySlug(slug: string) {
    const res = await this.strapi.get<StrapiCollectionResponse<RawBlogPost>>(
      `/api/blog-posts?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=coverImage`
    );
    const post = res?.data?.[0];
    return post ? this.mapBlogPost(post) : null;
  }

  async getSeoSettings() {
    const res = await this.strapi.get<StrapiSingleResponse<RawSeoSettings>>("/api/seo-settings");
    if (!res?.data) return null;
    return {
      siteName: res.data.siteName,
      defaultDescription: res.data.defaultDescription ?? null,
      facebookAppId: res.data.facebookAppId ?? null,
      googleAnalyticsId: res.data.googleAnalyticsId ?? null,
    };
  }

  private mapBlogPost(p: RawBlogPost) {
    return {
      id: p.documentId,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? null,
      body: p.body,
      seoTitle: p.seoTitle ?? null,
      seoDescription: p.seoDescription ?? null,
      coverImageUrl: this.strapi.resolveMediaUrl(p.coverImage?.url),
      coverAlt: p.coverAlt ?? null,
      publishedAt: p.publishedAt ?? null,
    };
  }
}
