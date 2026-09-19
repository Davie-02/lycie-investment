import { apiGet } from "./http";
import type { Testimonial } from "@/types/testimonial";
import type { Paginated } from "@/types/pagination";

export async function getTestimonials(): Promise<Testimonial[]> {
  const result = await apiGet<Paginated<Testimonial>>("/testimonials?pageSize=100");
  return result.items;
}
