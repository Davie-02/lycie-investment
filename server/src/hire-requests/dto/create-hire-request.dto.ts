/**
 * Allowed body for a hire request: contact details (deliverable email), which hire
 * vehicle, and pickup/return dates. The server recalculates the price itself.
 */
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateHireRequestDto {
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
  vehicleId!: string;

  @IsDateString()
  pickupDate!: string;

  @IsDateString()
  returnDate!: string;

  @IsString()
  @IsNotEmpty()
  pickupLocation!: string;

  @IsString()
  @IsOptional()
  additionalRequirements?: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
