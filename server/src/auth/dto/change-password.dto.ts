import { IsNotEmpty, IsString } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

/** An admin changing their own password from the Security page. */
export class ChangeAdminPasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
