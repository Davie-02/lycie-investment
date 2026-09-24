import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

/** An admin changing their own password from the Security page. */
export class ChangeAdminPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
