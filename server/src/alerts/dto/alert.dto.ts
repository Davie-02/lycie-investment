import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const trimOrNull = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() || undefined : value);

/** What a customer wants to hear about. At least one field must be filled (checked in the service). */
export class CreateVehicleAlertDto {
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(60)
  make?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(60)
  model?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(40)
  bodyType?: string;

  /** US dollars. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  minYear?: number;
}

export class UpdateVehicleAlertDto {
  @IsBoolean()
  isActive!: boolean;
}
