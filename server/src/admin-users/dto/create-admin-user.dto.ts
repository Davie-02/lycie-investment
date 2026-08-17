import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { AdminRole } from "@prisma/client";

export class CreateAdminUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(AdminRole)
  role!: AdminRole;
}