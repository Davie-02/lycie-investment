import { IsIn, IsString } from "class-validator";

const STATUSES = ["pending", "confirmed", "cancelled", "completed"];

export class UpdateHireRequestStatusDto {
  @IsString()
  @IsIn(STATUSES)
  status!: string;
}
