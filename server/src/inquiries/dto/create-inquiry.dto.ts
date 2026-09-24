/**
 * Allowed body for a vehicle inquiry: which vehicle, name, a real deliverable email,
 * phone, message and preferred contact method.
 */
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateInquiryDto {
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
  @IsOptional()
  @MaxLength(64)
  vehicleId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  message?: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
