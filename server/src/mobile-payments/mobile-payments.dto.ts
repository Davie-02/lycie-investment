import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export const PAYMENT_PURPOSES = ["deposit", "hire", "import", "clearing", "other"] as const;

export class StartMobilePaymentDto {
  /** Kwacha, whole numbers. */
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(50_000_000)
  amount!: number;

  @IsIn(PAYMENT_PURPOSES)
  purpose!: (typeof PAYMENT_PURPOSES)[number];

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  note?: string;

  /** Paying toward one of their purchases (instead of adding to their balance). */
  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  /** Paying for a hire booking (it becomes a purchase, priced from the booking). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  hireRequestId?: string;

  /** They've agreed that anything above what they owe goes to their account balance. */
  @IsOptional()
  @IsBoolean()
  acceptExcess?: boolean;
}
