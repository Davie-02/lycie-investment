import { IsNotEmpty, IsString } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

export class ChangeCustomerPasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
