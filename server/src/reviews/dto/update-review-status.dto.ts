import { IsIn } from "class-validator";

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export class UpdateReviewStatusDto {
  @IsIn(REVIEW_STATUSES)
  status!: ReviewStatus;
}
