import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
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

  @IsBoolean()
  @IsOptional()
  available?: boolean;

  @IsString()
  @IsNotEmpty()
  image!: string;
}
