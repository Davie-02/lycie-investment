/**
 * Allowed body for an import request: contact details (deliverable email), the vehicle
 * wanted, budget and timeline.
 */
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { Type } from "class-transformer";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateImportRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone!: string;

  @IsEmail()
  @IsDeliverableEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  preferredMake!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
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
  @MaxLength(300)
  fuelType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  transmission?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  vehicleType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  preferredSourceCountry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  additionalRequirements?: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
