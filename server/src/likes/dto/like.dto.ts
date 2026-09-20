import { IsBoolean, IsIn, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export const LIKE_KINDS = ["vehicle", "hire", "blog"] as const;
export type LikeKind = (typeof LIKE_KINDS)[number];

export class SetLikeDto {
  @IsIn(LIKE_KINDS)
  kind!: LikeKind;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetId!: string;

  @IsUUID()
  visitorId!: string;

  @IsBoolean()
  liked!: boolean;
}
