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

export function submitVisitorMessage(kind: "question" | "comment", message: string) {
  return apiPost<{ received: boolean }>("/lycie/submissions", { kind, message });
}

interface StreamHandlers {
  onDelta: (text: string) => void;
}

/**
 * Asks Lycie and shows the answer as it's written. The server sends one JSON
 * object per line: "delta" pieces of text, then a final "done" carrying the
 * tidied reply, vehicle cards and feedback id. Falls back to the ordinary
 * request if the browser can't stream.
 */
export async function streamLycieMessage(
  message: string,
  history: Array<{ role: "user" | "model"; text: string }>,
  { onDelta }: StreamHandlers
): Promise<LycieChatResponse> {
  const { fetchWithCsrf } = await import("./csrf");
  const { ApiError } = await import("./http");
  const { parseErrorMessage } = await import("@/utils/apiError");
  const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

  let response: Response;
  try {
    response = await fetchWithCsrf(`${base}/lycie/chat/stream`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please check your connection and try again.");
  }
  if (!response.ok) throw new ApiError(await parseErrorMessage(response), response.status);
  if (!response.body) return sendLycieMessage(message, history);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: LycieChatResponse | null = null;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { type: string; text?: string; message?: string } & Partial<LycieChatResponse>;
    if (event.type === "delta" && event.text) onDelta(event.text);
    else if (event.type === "done") final = event as LycieChatResponse;
    else if (event.type === "error") throw new ApiError(event.message ?? "Something went wrong.");
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      handleLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  }
  handleLine(buffer);
  if (!final) throw new ApiError("The answer was cut off. Please try again.");
  return final;
}
