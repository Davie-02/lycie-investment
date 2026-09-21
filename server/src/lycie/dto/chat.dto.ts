/**
 * Allowed body for a chat message to Lycie: the message and a short recent history, with
 * hard length limits so a visitor can't send huge prompts.
 */
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

export const MAX_MESSAGE_CHARS = 500;
export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_TURN_CHARS = 800;

export class HistoryTurnDto {
  @IsIn(["user", "model"])
  role!: "user" | "model";

  @IsString()
  @MaxLength(MAX_HISTORY_TURN_CHARS)
  text!: string;
}

export class ChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_MESSAGE_CHARS)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HISTORY_TURNS)
  @ValidateNested({ each: true })
  @Type(() => HistoryTurnDto)
  history?: HistoryTurnDto[];
}

export class FeedbackDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  logId!: string;

  @IsBoolean()
  helpful!: boolean;
}
