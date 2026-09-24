/**
 * Allowed body for the contact form: name, a real deliverable email, optional phone,
 * subject, message and preferred contact method. Anything else is rejected.
 */
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateContactMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  @IsDeliverableEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
