import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { WRITER_KINDS, WRITER_TONES, type WriterKind, type WriterTone } from "../prompt.builder";

export class WriteDto {
  @IsIn(Object.keys(WRITER_KINDS))
  kind!: WriterKind;

  @IsOptional()
  @IsIn(WRITER_TONES)
  tone?: WriterTone;

  /** What the admin wants written ("mention it is fuel efficient and ideal for city driving"). */
  @IsOptional()
  @IsString()
  @MaxLength(800)
  brief?: string;

  /** Known facts, one per line — e.g. the vehicle's specifications from the form. */
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  facts?: string;

  /** Existing text to improve or rewrite. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  current?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(3000)
  maxChars?: number;
}
