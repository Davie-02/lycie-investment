import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;

  @IsStrongPassword()
  newPassword!: string;
}
