import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PREFERRED_CONTACTS, type PreferredContact } from "../../common/preferred-contact";

export const REQUEST_TYPES = ["inquiry", "import", "clearing", "hire", "contact"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export class LogContactDto {
  @IsIn(PREFERRED_CONTACTS)
  method!: PreferredContact;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  subject!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;
}
