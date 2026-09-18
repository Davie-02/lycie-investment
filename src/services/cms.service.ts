import { apiGet, ApiError } from "./http";
import type { BlogPost, Faq, SeoSettings, Testimonial } from "@/types/cms";

/**
 * All CMS content is optional/best-effort: if Strapi isn't configured or is
 * unreachable, the NestJS /cms/* endpoints return empty results (see
 * server/src/cms) rather than errors, so these pages degrade gracefully
 * instead of breaking the site.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  return apiGet<Testimonial[]>("/cms/testimonials");
}

export async function getFaqs(): Promise<Faq[]> {
  return apiGet<Faq[]>("/cms/faq");
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return apiGet<BlogPost[]>("/cms/blog-posts");
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    return await apiGet<BlogPost>(`/cms/blog-posts/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function getSeoSettings(): Promise<SeoSettings | null> {
  return apiGet<SeoSettings | null>("/cms/seo-settings");
}
