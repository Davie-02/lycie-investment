import { IsString, MinLength } from "class-validator";

export class ChangeCustomerPasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
