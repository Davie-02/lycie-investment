import { apiGet } from "./http";
import type { PublicDeal } from "@/types/deal";

/** Published, unexpired deals for the public site. */
export function getDeals(): Promise<PublicDeal[]> {
  return apiGet<PublicDeal[]>("/deals");
}
