import { IsString, MaxLength } from "class-validator";

/** Body of POST /auth/check-email. Any string is accepted; the answer explains what's wrong with it. */
export class CheckEmailDto {
  @IsString()
  @MaxLength(254)
  email!: string;
}
