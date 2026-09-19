export interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export interface InsightRecommendation {
  severity: "action" | "opportunity" | "info";
  title: string;
  detail: string;
  vehicleId?: string;
  hireVehicleId?: string;
}

export interface InsightsOverview {
  generatedAt: string;
  totals: {
    reviews: number;
    pendingReviews: number;
    averageRating: number | null;
    feedbackCount: number;
    saves: number;
    views30d: number;
    inquiries90d: number;
  };
  sentiment: { reviews: SentimentCounts; messages: SentimentCounts; overall: SentimentCounts };
  ratingDistribution: number[];
  weeklyTrend: Array<{ weekStart: string; count: number; averageScore: number | null }>;
  themes: Array<SentimentCounts & { word: string; total: number }>;
  vehicles: Array<{
    id: string;
    label: string;
    status: string;
    saves: number;
    views30d: number;
    inquiries90d: number;
    reviewCount: number;
    avgRating: number | null;
  }>;
  hireVehicles: Array<{ id: string; name: string; available: boolean; requests90d: number; confirmed90d: number }>;
  recommendations: InsightRecommendation[];
}
