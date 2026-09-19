import { apiGet } from "./http";
import type { Testimonial } from "@/types/testimonial";

export async function getTestimonials(): Promise<Testimonial[]> {
  return apiGet<Testimonial[]>("/testimonials");
}
