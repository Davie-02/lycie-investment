import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

/**
 * Inviting a staff member. No password here: the server makes a strong
 * one-time password and emails it; the person must replace it at first sign-in.
 * `role` is EMPLOYEE for everyone except system administrators (OWNER).
 */
export class CreateAdminUserDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(["EMPLOYEE", "OWNER"])
  role!: "EMPLOYEE" | "OWNER";

  @IsOptional()
  @IsString()
  @MaxLength(40)
  department?: string;

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

  /** Per-person access overrides { module: level } — system administrators only. */
  @IsOptional()
  @IsObject()
  permissions?: Record<string, string>;
}
