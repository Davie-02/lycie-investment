import { IsIn, IsString } from "class-validator";

export const REQUEST_STATUSES = ["new", "contacted", "closed"];

export class UpdateRequestStatusDto {
  @IsString()
  @IsIn(REQUEST_STATUSES)
  status!: string;
}
