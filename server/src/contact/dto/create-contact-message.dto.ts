import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateContactMessageDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  @IsDeliverableEmail()
  email!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
