import { apiGet, apiPost } from "./http";

export type LikeKind = "vehicle" | "hire" | "blog";

export function setLike(kind: LikeKind, targetId: string, visitorId: string, liked: boolean) {
  return apiPost<{ count: number }>("/likes", { kind, targetId, visitorId, liked });
}

export function getLikeCounts(kind: LikeKind, ids: string[]) {
  return apiGet<{ counts: Record<string, number> }>(`/likes/counts?kind=${kind}&ids=${encodeURIComponent(ids.join(","))}`);
}
