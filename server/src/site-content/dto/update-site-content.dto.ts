import { IsObject } from "class-validator";

export class UpdateSiteContentDto {
  @IsObject()
  value!: Record<string, unknown>;
}
