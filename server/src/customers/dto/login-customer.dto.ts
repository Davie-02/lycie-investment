import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginCustomerDto {
  @IsEmail()
  email!: string;

  // Not held to the strength rules: older accounts must still be able to sign in.
  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
