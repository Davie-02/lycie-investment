import { IsInt, IsOptional, IsPositive, IsString, Min } from "class-validator";

export class CreateFinancialTransactionDto {
  @IsInt()
  @IsPositive()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;
}