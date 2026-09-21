import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

export class RegisterCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  // Checked against the shared password policy (length, mix, common passwords,
  // not containing the name/email above) — see security/password-policy.ts.
  @IsStrongPassword()
  password!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
