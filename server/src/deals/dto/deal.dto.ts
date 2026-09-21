import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

/** Allowed body for adding a deal by hand. Anything else is rejected. */
export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  /** What visitors read. Keep it free of company names and web addresses. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  summary!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  priceUsd?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vehicleLabel?: string | null;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  /** Staff-only notes: who to contact and the steps to get the deal. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  howToGet?: string;
}

/** Any subset of the fields above. */
export class UpdateDealDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(500) summary?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) priceUsd?: number | null;
  @IsOptional() @IsString() @MaxLength(120) vehicleLabel?: string | null;
  @IsOptional() @IsDateString() validUntil?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) howToGet?: string;
}
