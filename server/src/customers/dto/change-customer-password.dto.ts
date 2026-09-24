import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { IsStrongPassword } from "../../security/password-policy";

export class ChangeCustomerPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsStrongPassword()
  newPassword!: string;
}
