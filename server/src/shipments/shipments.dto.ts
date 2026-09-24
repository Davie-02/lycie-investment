import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from "class-validator";
import { STAGE_KEYS } from "./stages";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class CreateShipmentDto {
  @IsUUID()
  customerId!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsIn(["import", "clearing"])
  kind!: "import" | "clearing";

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  details?: string;

  @IsOptional()
  @IsDateString()
  eta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleId?: string;
}

export class UpdateShipmentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsDateString()
  eta?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  details?: string;
}

export class ShipmentProgressDto {
  @IsIn(STAGE_KEYS)
  stage!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  photos?: string[];
}
