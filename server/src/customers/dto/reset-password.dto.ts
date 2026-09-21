import { IsNotEmpty, IsString } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsStrongPassword()
  newPassword!: string;
}
