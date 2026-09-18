import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { CmsService } from "./cms.service";

// All public, read-only — content editing happens in Strapi's own admin UI,
// not through this app, so there's nothing to guard here.
@Controller("cms")
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  @Get("testimonials")
  testimonials() {
    return this.cms.getTestimonials();
  }

  @Get("faq")
  faq() {
    return this.cms.getFaqs();
  }

  @Get("blog-posts")
  blogPosts() {
    return this.cms.getBlogPosts();
  }

  @Get("blog-posts/:slug")
  async blogPost(@Param("slug") slug: string) {
    const post = await this.cms.getBlogPostBySlug(slug);
    if (!post) {
      throw new NotFoundException("Blog post not found.");
    }
    return post;
  }

  @Get("seo-settings")
  async seoSettings() {
    // Nest sends an empty HTTP body (not the JSON literal `null`) for a
    // controller returning `null` — {} keeps this endpoint's response
    // always valid, parseable JSON when no CMS content is published yet.
    return (await this.cms.getSeoSettings()) ?? {};
  }
}
