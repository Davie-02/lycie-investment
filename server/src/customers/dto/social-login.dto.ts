import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

/** Body for POST /customers/social/google — `credential` is the ID token Google's button returns. */
export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  credential!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

/** Body for POST /customers/social/facebook — the access token from Facebook's login dialog. */
export class FacebookLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}

/** Body for POST /customers/verify-email. */
export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
