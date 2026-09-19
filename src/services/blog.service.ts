import { apiGet, ApiError } from "./http";
import type { BlogPost } from "@/types/blogPost";

export async function getBlogPosts(): Promise<BlogPost[]> {
  return apiGet<BlogPost[]>("/blog-posts");
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    return await apiGet<BlogPost>(`/blog-posts/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}
