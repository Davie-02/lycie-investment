import { IsArray, IsIn, IsInt, IsNotEmpty, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];
const TRANSMISSIONS = ["Automatic", "Manual"];
const STATUSES = ["available", "reserved", "sold"];

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  make!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @Type(() => Number)
  @IsInt()
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileageKm!: number;

  @IsString()
  @IsIn(FUEL_TYPES)
  fuelType!: string;

  @IsString()
  @IsIn(TRANSMISSIONS)
  transmission!: string;

  @IsString()
  @IsNotEmpty()
  bodyType!: string;

  @IsString()
  @IsNotEmpty()
  engine!: string;

  @IsString()
  @IsNotEmpty()
  driveType!: string;

  @IsString()
  @IsNotEmpty()
  condition!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsIn(STATUSES)
  status!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @IsArray()
  @IsString({ each: true })
  images!: string[];
}
