import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateImportRequestDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  preferredMake!: string;

  @IsString()
  @IsOptional()
  preferredModel?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  preferredYear?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  budget?: number;

  @IsString()
  @IsOptional()
  fuelType?: string;

  @IsString()
  @IsOptional()
  transmission?: string;

  @IsString()
  @IsOptional()
  vehicleType?: string;

  @IsString()
  @IsOptional()
  preferredSourceCountry?: string;

  @IsString()
  @IsOptional()
  additionalRequirements?: string;
}
