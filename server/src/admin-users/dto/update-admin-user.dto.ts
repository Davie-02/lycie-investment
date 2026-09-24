import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class UpdateAdminUserDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name?: string;

  /** EMPLOYEE or OWNER; legacy MANAGER/VIEWER accepted so old accounts can be left as they are. */
  @IsOptional()
  @IsIn(["EMPLOYEE", "OWNER", "MANAGER", "VIEWER"])
  role?: "EMPLOYEE" | "OWNER" | "MANAGER" | "VIEWER";

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsString()
  @MaxLength(40)
  department?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  phone?: string;

  /** Per-person access overrides; null clears them (back to department defaults). System administrators only. */
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsObject()
  permissions?: Record<string, string> | null;

  /** Clears this person's two-factor setup (lost phone). System administrators only. */
  @IsOptional()
  @IsBoolean()
  resetTwoFactor?: boolean;

  /** Emails a new one-time password (forgotten password, expired invitation). */
  @IsOptional()
  @IsBoolean()
  resendInvite?: boolean;
}
