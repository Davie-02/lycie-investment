import { IsEmail, IsEnum, IsNotEmpty, IsString } from "class-validator";
import { AdminRole } from "@prisma/client";
import { IsStrongPassword } from "../../security/password-policy";

export class CreateAdminUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsStrongPassword()
  password!: string;

  @IsEnum(AdminRole)
  role!: AdminRole;
}
