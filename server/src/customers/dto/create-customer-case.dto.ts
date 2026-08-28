import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import { CustomerCaseStatus } from "@prisma/client";

export class CreateCustomerCaseDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsUUID()
  hireVehicleId?: string;

  @IsOptional()
  @IsEnum(CustomerCaseStatus)
  status?: CustomerCaseStatus;
}