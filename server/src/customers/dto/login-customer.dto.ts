import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class LoginCustomerDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Not held to the strength rules: older accounts must still be able to sign in.
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
