import { apiGet } from "./http";
import type { Faq } from "@/types/faq";

export async function getFaqs(): Promise<Faq[]> {
  return apiGet<Faq[]>("/faq");
}
