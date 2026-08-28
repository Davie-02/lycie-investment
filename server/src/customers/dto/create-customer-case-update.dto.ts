import { IsEnum, IsString, MinLength } from "class-validator";
import { CustomerCaseStatus } from "@prisma/client";

export class CreateCustomerCaseUpdateDto {
  @IsEnum(CustomerCaseStatus)
  status!: CustomerCaseStatus;

  @IsString()
  @MinLength(2)
  message!: string;
}