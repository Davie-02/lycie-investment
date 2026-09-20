import { IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PreferredContact, PreferredContactField } from "../../common/preferred-contact";

export class CreateHireRequestDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
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
