import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { BlogPostsService } from "./blog-posts.service";
import { CreateBlogPostDto } from "./dto/create-blog-post.dto";
import { UpdateBlogPostDto } from "./dto/update-blog-post.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("blog-posts")
export class BlogPostsController {
  constructor(private readonly blogPostsService: BlogPostsService) {}

  @Get()
  findPublished() {
    return this.blogPostsService.findPublished();
  }

  // Must come before ":slug" so "all" isn't captured as a slug.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Get("all")
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.blogPostsService.findAll(this.parseNumber(page, 1), this.parsePageSize(pageSize, 20));
  }

  @Get(":slug")
  findPublishedBySlug(@Param("slug") slug: string) {
    return this.blogPostsService.findPublishedBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Post()
  create(@Body() dto: CreateBlogPostDto) {
    return this.blogPostsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateBlogPostDto) {
    return this.blogPostsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("OWNER", "MANAGER")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.blogPostsService.remove(id);
  }

  private parseNumber(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
  }

  private parsePageSize(value: string | undefined, fallback: number): number {
    return Math.min(100, this.parseNumber(value, fallback));
  }
}
