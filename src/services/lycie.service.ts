import { apiGet, apiPost } from "./http";
import type { LycieChatResponse } from "@/types/lycie";

export function getLycieStatus() {
  return apiGet<{ enabled: boolean }>("/lycie/status");
}

export function sendLycieMessage(message: string, history: Array<{ role: "user" | "model"; text: string }>) {
  return apiPost<LycieChatResponse>("/lycie/chat", { message, history });
}

export function sendLycieFeedback(logId: string, helpful: boolean) {
  return apiPost<{ recorded: boolean }>("/lycie/feedback", { logId, helpful });
}
