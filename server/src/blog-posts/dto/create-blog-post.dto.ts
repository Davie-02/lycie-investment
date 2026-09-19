import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateBlogPostDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  coverAlt?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  // Translated to publishedAt (now, or null) by the service — not a
  // real column itself, so the admin picks "published" rather than an
  // exact timestamp.
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
