import { apiGet } from "./http";
import type { Faq } from "@/types/faq";
import type { Paginated } from "@/types/pagination";

export async function getFaqs(): Promise<Faq[]> {
  const result = await apiGet<Paginated<Faq>>("/faq?pageSize=100");
  return result.items;
}
