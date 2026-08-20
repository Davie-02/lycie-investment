import { IsIn, IsString } from "class-validator";

const STATUSES = ["pending", "confirmed", "cancelled"];

export class UpdateHireRequestStatusDto {
  @IsString()
  @IsIn(STATUSES)
  status!: string;
}
