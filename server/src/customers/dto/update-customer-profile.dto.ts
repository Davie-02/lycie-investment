import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, Matches } from "class-validator";

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** For WhatsApp updates (optional). Empty string removes it. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^$|^[+\d][\d\s().-]{6,}$/, { message: "Enter a phone number like 0991 234 567 or +265 991 234 567." })
  phone?: string;
}
