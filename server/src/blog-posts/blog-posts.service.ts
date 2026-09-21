/**
 * Database access for blog posts: the public list and single post by slug (published
 * only), the admin list of everything, and create/edit/delete with unique slugs.
 */
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PUBLIC } from "../content-admin/content-state";
import { CreateBlogPostDto } from "./dto/create-blog-post.dto";
import { UpdateBlogPostDto } from "./dto/update-blog-post.dto";

@Injectable()
export class BlogPostsService {
  constructor(private readonly prisma: PrismaService) {}

  findPublished() {
    return this.prisma.blogPost.findMany({
      where: PUBLIC["blog-posts"],
      orderBy: { publishedAt: "desc" },
    });
  }

  async findPublishedBySlug(slug: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (!post || !post.publishedAt || post.archivedAt) {
      throw new NotFoundException("Blog post not found.");
    }
    return post;
  }

  async findAll(page = 1, pageSize = 20) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.blogPost.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.blogPost.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async create(dto: CreateBlogPostDto) {
    await this.ensureSlugAvailable(dto.slug);
    const { isPublished, ...rest } = dto;

    return this.prisma.blogPost.create({
      data: { ...rest, publishedAt: isPublished ? new Date() : null },
    });
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    await this.ensureExists(id);
    if (dto.slug) {
      await this.ensureSlugAvailable(dto.slug, id);
    }

    const { isPublished, ...rest } = dto;

    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...rest,
        ...(isPublished !== undefined ? { publishedAt: isPublished ? new Date() : null } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.blogPost.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureExists(id: string) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`No blog post found with id "${id}".`);
    }
  }

  private async ensureSlugAvailable(slug: string, excludingId?: string) {
    const existing = await this.prisma.blogPost.findUnique({ where: { slug } });
    if (existing && existing.id !== excludingId) {
      throw new ConflictException(`A blog post with the slug "${slug}" already exists.`);
    }
  }
}
