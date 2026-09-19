import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const KNOWLEDGE_CATEGORIES = ["faq", "policy", "process", "pricing", "other"] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export class CreateKnowledgeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsIn(KNOWLEDGE_CATEGORIES)
  category!: KnowledgeCategory;

  // Each entry goes into every prompt, so keep entries focused.
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsIn(KNOWLEDGE_CATEGORIES)
  category?: KnowledgeCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
