import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/** Second step of admin sign-in: the token from step one plus a 6-digit (or recovery) code. */
export class TwoFactorLoginDto {
  @IsString()
  @IsNotEmpty()
  challenge!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}

/** Just a code — used to switch two-factor on. */
export class TwoFactorCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}

/** Switching two-factor off needs the password AND a current code, so a stolen session alone can't disable it. */
export class DisableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}
