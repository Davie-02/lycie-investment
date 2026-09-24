/**
 * Allowed body for a clearing request: contact details (deliverable email), the vehicle
 * and shipment details, and optional notes.
 */
import { IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { Type } from "class-transformer";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateClearingRequestDto {
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
  vehicleMake!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  vehicleModel?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  year?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  vin!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  currentLocation!: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  arrivalPortOrBorder?: string;

  @IsDateString()
  @IsOptional()
  expectedArrivalDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  availableDocuments?: string;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  additionalInformation?: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
