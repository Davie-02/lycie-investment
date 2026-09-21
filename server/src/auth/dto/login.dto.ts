import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  // Deliberately not checked against the password-strength rules — people whose
  // password predates them must still be able to sign in.
  @IsString()
  @IsNotEmpty()
  password!: string;

  /** "Keep me signed in": 30-day persistent session instead of the short one. */
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
