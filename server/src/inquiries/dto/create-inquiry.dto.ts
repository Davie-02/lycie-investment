import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IsDeliverableEmail } from "../../security/email-check";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateInquiryDto {
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
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @PreferredContactField()
  preferredContact?: PreferredContact;
}
