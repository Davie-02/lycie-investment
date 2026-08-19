import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

const TYPES = ["info", "warning", "success", "promo"];
const DISPLAY_MODES = ["banner", "popup"];

export class CreateNoticeDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsIn(TYPES)
  type!: string;

  @IsString()
  @IsIn(DISPLAY_MODES)
  displayAs!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
