/**
 * Shapes of customer reviews: the public list (approved only) and the admin version with
 * moderation status and sentiment. Mirrors server/src/reviews/.
 */
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface PublicReviewList {
  items: PublicReview[];
  total: number;
  page: number;
  pageSize: number;
  averageRating: number | null;
}

export type ReviewStatus = "pending" | "approved" | "rejected";
export type Sentiment = "positive" | "neutral" | "negative";

export interface AdminReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  sentiment: Sentiment;
  sentimentScore: number;
  keywords: string[];
  createdAt: string;
  vehicle: { make: string; model: string; year: number; slug: string } | null;
}
