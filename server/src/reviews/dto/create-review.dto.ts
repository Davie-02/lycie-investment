import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateReviewDto {
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  authorName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @Transform(trim)
  @IsString()
  @Length(10, 1000)
  comment!: string;

  /** Omit to leave a review about the company itself. */
  @IsOptional()
  @IsString()
  vehicleId?: string;
}
