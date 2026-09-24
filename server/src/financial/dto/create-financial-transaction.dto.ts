import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class CreateFinancialTransactionDto {
  // multipart/form-data (required alongside the proof-of-payment file
  // upload) always arrives as strings — without this, IsInt/Min fail on
  // every submission since they never see an actual number.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000_000)
  amount!: number;

  /** What it's for — required for a deposit that isn't for a purchase or booking. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;

  /** The purchase this payment is for (optional). */
  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  /** A hire booking it's for (becomes a purchase, priced from the booking). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  hireRequestId?: string;

  /** Agreed that anything above what's owed goes to the account balance ("true" in a form). */
  @IsOptional()
  @IsIn([true, false, "true", "false"])
  acceptExcess?: boolean | "true" | "false";
}
