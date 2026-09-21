import { apiGet } from "./http";

/** The exchange rate the API says to use (GET /api/pricing). `rate` is kwacha per 1 US dollar. */
export interface PricingRate {
  rate: number | null;
  source: "live" | "manual" | "last-known" | "none";
  updatedAt: string | null;
  roundMwkTo: number;
}

export function getPricingRate(): Promise<PricingRate> {
  return apiGet<PricingRate>("/pricing");
}
