/**
 * Allowed body for a clearing request: contact details (deliverable email), the vehicle
 * and shipment details, and optional notes.
 */
import { IsDateString, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { Type } from "class-transformer";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateClearingRequestDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  @IsDeliverableEmail()
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

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
