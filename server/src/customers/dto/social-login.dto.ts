import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

/** Body for POST /customers/social/google — `credential` is the ID token Google's button returns. */
export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  credential!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

/** Body for POST /customers/social/facebook — the access token from Facebook's login dialog. */
export class FacebookLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  accessToken!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

/** Body for POST /customers/verify-email. */
export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;
}
