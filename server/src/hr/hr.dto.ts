import { Transform } from "class-transformer";
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from "class-validator";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
export const LEAVE_TYPES = ["annual", "sick", "family", "unpaid", "other"] as const;

export class CreateLeaveDto {
  @IsIn(LEAVE_TYPES)
  type!: (typeof LEAVE_TYPES)[number];

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ReviewLeaveDto {
  @IsIn(["approved", "declined"])
  status!: "approved" | "declined";

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}
