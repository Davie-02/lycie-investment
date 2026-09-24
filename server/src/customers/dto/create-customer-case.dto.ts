/**
 * Allowed body for creating a customer case: which customer, a title, optional details
 * and the vehicle it concerns. Anything else in the request is rejected.
 */
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

  // Vehicle ids are cuids, not UUIDs.
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  hireVehicleId?: string;

  @IsOptional()
  @IsEnum(CustomerCaseStatus)
  status?: CustomerCaseStatus;
}