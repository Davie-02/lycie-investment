import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
