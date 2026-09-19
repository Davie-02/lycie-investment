/**
 * Turns aggregated demand/feedback signals into plain-language advice for
 * admins. Rule-based on purpose: every recommendation can be traced back to
 * a specific number and threshold below, so an admin can judge it (and we
 * can test it) instead of trusting an opaque score.
 */

export interface VehicleSignal {
  id: string;
  label: string;
  make: string;
  status: string;
  ageDays: number;
  saves: number;
  views30d: number;
  inquiries90d: number;
  reviewCount: number;
  avgRating: number | null;
}

export interface HireSignal {
  id: string;
  name: string;
  available: boolean;
  requests90d: number;
  confirmed90d: number;
}

export interface ThemeSignal {
  word: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface RecommendationInput {
  vehicles: VehicleSignal[];
  hireVehicles: HireSignal[];
  themes: ThemeSignal[];
  pendingReviews: number;
  feedbackCount: number;
}

export type RecommendationSeverity = "action" | "opportunity" | "info";

export interface Recommendation {
  severity: RecommendationSeverity;
  title: string;
  detail: string;
  vehicleId?: string;
  hireVehicleId?: string;
}

export const THRESHOLDS = {
  /** Views or saves needed before "lots of interest, no inquiries" is meaningful. */
  interestViews: 15,
  interestSaves: 3,
  lowRating: 2.5,
  minReviewsForRating: 2,
  recurringConcernMentions: 3,
  staleStockAgeDays: 45,
  hireDemandRequests: 3,
  hireDemandConversion: 0.5,
  topMakeMinSignals: 5,
  topMakeShare: 0.4,
} as const;

const SEVERITY_ORDER: Record<RecommendationSeverity, number> = { action: 0, opportunity: 1, info: 2 };

export function buildRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];

  if (input.pendingReviews > 0) {
    out.push({
      severity: "action",
      title: `${input.pendingReviews} review${input.pendingReviews === 1 ? "" : "s"} waiting for moderation`,
      detail: "Customers are waiting for their feedback to appear. Approve or reject them from the Reviews page.",
    });
  }

  for (const vehicle of input.vehicles) {
    if (vehicle.status !== "available") continue;

    const interested =
      vehicle.views30d >= THRESHOLDS.interestViews || vehicle.saves >= THRESHOLDS.interestSaves;

    if (interested && vehicle.inquiries90d === 0) {
      out.push({
        severity: "opportunity",
        title: `${vehicle.label}: attention but no inquiries`,
        detail: `${vehicle.views30d} views (30 days) and ${vehicle.saves} saves, yet no inquiries. Consider a price review, better photos, or a promotion notice.`,
        vehicleId: vehicle.id,
      });
    }

    if (
      vehicle.avgRating !== null &&
      vehicle.reviewCount >= THRESHOLDS.minReviewsForRating &&
      vehicle.avgRating <= THRESHOLDS.lowRating
    ) {
      out.push({
        severity: "action",
        title: `${vehicle.label}: low customer rating (${vehicle.avgRating.toFixed(1)}/5)`,
        detail: `Rated ${vehicle.avgRating.toFixed(1)} across ${vehicle.reviewCount} reviews. Read the reviews and check the listing is accurate.`,
        vehicleId: vehicle.id,
      });
    }

    const noInterest =
      vehicle.ageDays >= THRESHOLDS.staleStockAgeDays &&
      vehicle.views30d < 3 &&
      vehicle.saves === 0 &&
      vehicle.inquiries90d === 0;

    if (noInterest) {
      out.push({
        severity: "info",
        title: `${vehicle.label}: stale listing`,
        detail: `Listed ${vehicle.ageDays} days with almost no views, saves, or inquiries. It may need refreshed photos, a lower price, or a featured spot.`,
        vehicleId: vehicle.id,
      });
    }
  }

  for (const theme of input.themes) {
    if (
      theme.negative >= THRESHOLDS.recurringConcernMentions &&
      theme.negative > theme.positive
    ) {
      out.push({
        severity: "action",
        title: `Recurring concern: "${theme.word}"`,
        detail: `Mentioned in ${theme.negative} negative comments (vs ${theme.positive} positive). Worth looking into what customers are experiencing around this.`,
      });
    }
  }

  for (const hire of input.hireVehicles) {
    if (hire.requests90d >= THRESHOLDS.hireDemandRequests) {
      const conversion = hire.confirmed90d / hire.requests90d;
      if (conversion >= THRESHOLDS.hireDemandConversion) {
        out.push({
          severity: "opportunity",
          title: `${hire.name}: strong hire demand`,
          detail: `${hire.requests90d} requests in 90 days and ${Math.round(conversion * 100)}% confirmed. Consider adding a similar vehicle to the hire fleet.`,
          hireVehicleId: hire.id,
        });
      }
    }
  }

  const makeSignals = new Map<string, number>();
  let totalSignals = 0;
  for (const vehicle of input.vehicles) {
    const signal = vehicle.saves + vehicle.inquiries90d;
    totalSignals += signal;
    makeSignals.set(vehicle.make, (makeSignals.get(vehicle.make) ?? 0) + signal);
  }
  if (totalSignals >= THRESHOLDS.topMakeMinSignals) {
    const [topMake, topCount] = Array.from(makeSignals.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCount / totalSignals >= THRESHOLDS.topMakeShare) {
      out.push({
        severity: "opportunity",
        title: `Buyers favour ${topMake}`,
        detail: `${Math.round((topCount / totalSignals) * 100)}% of saves and inquiries are for ${topMake} vehicles. Prioritise sourcing more of them.`,
      });
    }
  }

  if (out.length === 0) {
    out.push({
      severity: "info",
      title: input.feedbackCount === 0 ? "Not enough data yet" : "Nothing needs attention",
      detail:
        input.feedbackCount === 0
          ? "Recommendations appear once visitors start viewing vehicles, saving favourites, and leaving reviews or messages."
          : "No concerns or standout opportunities detected right now. Check back as more activity comes in.",
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
