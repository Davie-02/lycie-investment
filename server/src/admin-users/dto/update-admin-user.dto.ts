import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { AdminRole } from "@prisma/client";

export class UpdateAdminUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
}