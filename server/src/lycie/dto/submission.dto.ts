/**
 * Allowed bodies for the visitor 'Ask us' form and for admins changing a submission's
 * status or editing an FAQ suggestion.
 */
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const SUBMISSION_KINDS = ["question", "comment"] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

export class CreateSubmissionDto {
  @IsIn(SUBMISSION_KINDS)
  kind!: SubmissionKind;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  message!: string;
}

export class UpdateSubmissionStatusDto {
  @IsIn(["new", "handled"])
  status!: "new" | "handled";
}

export class EditSuggestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  question?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  answer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;
}
