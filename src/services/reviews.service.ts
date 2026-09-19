import { apiGet, apiPost } from "./http";
import type { PublicReviewList } from "@/types/review";

export function getReviews(vehicleId: string | undefined, page = 1) {
  const params = new URLSearchParams({ page: String(page), pageSize: "10" });
  if (vehicleId) params.set("vehicleId", vehicleId);
  return apiGet<PublicReviewList>(`/reviews?${params.toString()}`);
}

export function submitReview(payload: {
  authorName: string;
  rating: number;
  comment: string;
  vehicleId?: string;
}) {
  return apiPost<{ id: string; status: string }>("/reviews", payload);
}

/**
 * Counts a vehicle page view (one per browser session per vehicle). Failures
 * are swallowed on purpose — analytics must never break the page it measures.
 */
export function recordVehicleView(vehicleId: string): void {
  const key = `viewed:${vehicleId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked (private mode) — count it; worst case is a repeat view.
  }
  void apiPost(`/insights/vehicle-views/${encodeURIComponent(vehicleId)}`, {}).catch(() => undefined);
}
