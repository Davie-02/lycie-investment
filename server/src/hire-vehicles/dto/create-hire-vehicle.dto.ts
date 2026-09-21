import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
const TRANSMISSIONS = ["Automatic", "Manual"];

export class CreateHireVehicleDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyRate!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  weeklyRate?: number;

  @IsString()
  @IsIn(TRANSMISSIONS)
  transmission!: string;

  @IsString()
  @IsIn(FUEL_TYPES)
  fuelType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats!: number;

  /** Rates are entered in US dollars. Older listings may still be "MWK" until edited or bulk-converted. */
  @IsIn(["USD", "MWK"])
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  available?: boolean;

  /** Cover photo. Optional when `images` is given (the first gallery image is used). */
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  image?: string;

  /** Full gallery in display order; the first one is the cover. */
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
