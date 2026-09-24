/**
 * Allowed body for a hire request: contact details (deliverable email), which hire
 * vehicle, and pickup/return dates. The server recalculates the price itself.
 */
import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateHireRequestDto {
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
  @MaxLength(64)
  vehicleId!: string;

  @IsDateString()
  pickupDate!: string;

  @IsDateString()
  returnDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  pickupLocation!: string;

  @IsString()
  @IsOptional()
  @MaxLength(3000)
  additionalRequirements?: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
