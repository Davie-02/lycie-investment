import { IsOptional, IsString, MaxLength } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

/** Body of POST /auth/first-password: the challenge from sign-in and the person's own new password. */
export class FirstPasswordDto {
  @IsString()
  @MaxLength(2048)
  challenge!: string;

  @IsStrongPassword()
  newPassword!: string;
}

/** Body of POST /auth/confirm-identity. */
export class ConfirmIdentityDto {
  @IsString()
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;
}
