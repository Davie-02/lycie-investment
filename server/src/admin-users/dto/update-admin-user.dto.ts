import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { AdminRole } from "@prisma/client";
import { IsStrongPassword } from "../../security/password-policy";

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

  @IsStrongPassword()
  @IsOptional()
  password?: string;

  /** Owner-only recovery: clear this person's two-factor setup (lost phone, no recovery codes). */
  @IsBoolean()
  @IsOptional()
  resetTwoFactor?: boolean;
}
