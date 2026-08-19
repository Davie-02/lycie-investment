import { IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class CreateClearingRequestDto {
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
  vehicleMake!: string;

  @IsString()
  @IsOptional()
  vehicleModel?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  year?: number;

  @IsString()
  @IsNotEmpty()
  vin!: string;

  @IsString()
  @IsNotEmpty()
  currentLocation!: string;

  @IsString()
  @IsOptional()
  arrivalPortOrBorder?: string;

  @IsDateString()
  @IsOptional()
  expectedArrivalDate?: string;

  @IsString()
  @IsOptional()
  availableDocuments?: string;

  @IsString()
  @IsOptional()
  additionalInformation?: string;
}
