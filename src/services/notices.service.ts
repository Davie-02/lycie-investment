import { apiGet } from "./http";
import type { Notice } from "@/types/notice";

export async function getActiveNotices(): Promise<Notice[]> {
  return apiGet<Notice[]>("/notices");
}
