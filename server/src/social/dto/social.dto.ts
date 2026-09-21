import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

const CHANNELS = ["facebook", "instagram"];

/** Allowed body for writing a social post. Anything else is rejected. */
export class CreateSocialPostDto {
  /** The words of the post (Instagram allows up to about 2,200 characters). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;

  /** A picture: an address, or a "/uploads/…" path from the admin's uploader. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  linkUrl?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @IsIn(CHANNELS, { each: true })
  channels!: string[];

  /** now = send immediately; schedule = send at `scheduledFor`; draft = just save. */
  @IsIn(["now", "schedule", "draft"])
  mode!: "now" | "schedule" | "draft";

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

/** Allowed body for answering a comment or a private message. */
export class ReplyDto {
  @IsIn(CHANNELS)
  channel!: "facebook" | "instagram";

  @IsIn(["comment", "message"])
  kind!: "comment" | "message";

  /** The comment id, or (for messages) the id of the person to reply to. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;
}
