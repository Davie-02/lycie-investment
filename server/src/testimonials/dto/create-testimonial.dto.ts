/**
 * Allowed body for a testimonial: quote, author, rating, optional photo. Anything else
 * is rejected.
 */
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateTestimonialDto {
  @IsString()
  @IsNotEmpty()
  quote!: string;

  @IsString()
  @IsNotEmpty()
  authorName!: string;

  @IsString()
  @IsOptional()
  authorTitle?: string;

  @IsString()
  @IsOptional()
  authorPhotoUrl?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
