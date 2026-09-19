import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateFinancialTransactionDto {
  // multipart/form-data (required alongside the proof-of-payment file
  // upload) always arrives as strings — without this, IsInt/Min fail on
  // every submission since they never see an actual number.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}