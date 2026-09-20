import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

export const GEMINI_FETCH = "GEMINI_FETCH";
export const GEMINI_CONFIG = "GEMINI_CONFIG";

export interface GeminiConfig {
  apiKey: string | undefined;
  /** Tried in order; the first healthy one that answers wins. */
  models: string[];
  /** 0 disables "thinking" — faster and cheaper, plenty for customer chat. */
  thinkingBudget: number;
  maxOutputTokens: number;
  perAttemptTimeoutMs: number;
  totalBudgetMs: number;
  /** Streaming: give up on a model that hasn't produced a first word by then. */
  firstTokenTimeoutMs: number;
  /** Streaming: hard cap for one whole streamed answer. */
  streamTimeoutMs: number;
}

// Order matters: measured first-word times were ~2.5s (3.8-flash, when not overloaded), ~2.2s
// (3.1-flash-lite) and ~13s (3.5-flash — kept only as a last resort). 3.5-flash-lite rejects
// our request settings (HTTP 400), so it is not in the default chain.
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash"];

export function readGeminiConfig(env: NodeJS.ProcessEnv = process.env): GeminiConfig {
  const models = (env.LYCIE_CHAT_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const number = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return value !== undefined && value !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    apiKey: env.GEMINI_API_KEY?.trim() || undefined,
    models: models.length ? models : DEFAULT_MODELS,
    thinkingBudget: number(env.LYCIE_THINKING_BUDGET, 0),
    maxOutputTokens: number(env.LYCIE_MAX_OUTPUT_TOKENS, 700),
    // A model slower than this is abandoned for the next (faster) one — a
    // customer waiting 15s+ for a chat reply is worse than a lighter model's answer.
    perAttemptTimeoutMs: 10_000,
    totalBudgetMs: 25_000,
    firstTokenTimeoutMs: 6_000,
    streamTimeoutMs: 40_000,
  };
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
  /** An image the model should look at (used to read uploaded pictures into knowledge). */
  image?: { mimeType: string; data: string };
}

export interface GeminiResult {
  text: string;
  model: string;
}

/** Nothing could answer right now (quota, outage, timeouts, missing key). */
export class GeminiUnavailableError extends Error {}
/** Google declined to answer the prompt (safety block). Retrying elsewhere won't help. */
export class GeminiBlockedError extends Error {}

const MINUTE = 60_000;

type FetchFn = typeof fetch;

/**
 * Talks to Google's Gemini REST API with an ordered fallback chain.
 *
 * The free tier has per-model daily and per-minute quotas and the newest
 * models are sometimes overloaded (503). Rather than fail the customer, a
 * model that errors is put on a short "cooldown" and the next model in
 * LYCIE_CHAT_MODELS is tried. Cooldowns are remembered so a broken model
 * isn't retried on every message (which would add seconds of latency).
 */
@Injectable()
export class GeminiClient {
  private readonly logger = new Logger(GeminiClient.name);
  private readonly cooldownUntil = new Map<string, number>();
  private readonly config: GeminiConfig;
  private readonly fetchFn: FetchFn;
  /** Overridable in tests. */
  now: () => number = () => Date.now();

  constructor(
    @Optional() @Inject(GEMINI_FETCH) fetchFn?: FetchFn,
    @Optional() @Inject(GEMINI_CONFIG) config?: GeminiConfig
  ) {
    this.fetchFn = fetchFn ?? ((...args) => fetch(...args));
    this.config = config ?? readGeminiConfig();
  }

  /**
   * Models worth trying now: those not cooling down. If EVERY model is cooling down
   * (a brief overload can knock out all of them at once) we still try the one that
   * recovers soonest — a customer is better served by one more attempt than by an
   * instant "I'm having trouble" for the rest of the cooldown.
   */
  private candidates(): string[] {
    const now = this.now();
    const ready = this.config.models.filter((model) => (this.cooldownUntil.get(model) ?? 0) <= now);
    if (ready.length > 0) return ready;
    const soonest = [...this.config.models].sort((a, b) => (this.cooldownUntil.get(a) ?? 0) - (this.cooldownUntil.get(b) ?? 0))[0];
    return soonest ? [soonest] : [];
  }

  get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async generate(system: string, turns: ChatTurn[]): Promise<GeminiResult> {
    if (!this.config.apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured.");

    const startedAt = this.now();
    let lastError = "no model available";

    for (const model of this.candidates()) {
      const remaining = this.config.totalBudgetMs - (this.now() - startedAt);
      if (remaining < 2_000) break;

      try {
        const text = await this.callModel(model, system, turns, Math.min(this.config.perAttemptTimeoutMs, remaining));
        return { text, model };
      } catch (error) {
        if (error instanceof GeminiBlockedError) throw error;
        if (error instanceof KeyError) {
          this.logger.error(`Gemini rejected the API key (${error.message}). Check GEMINI_API_KEY.`);
          throw new GeminiUnavailableError("The AI provider rejected the API key.");
        }
        const failure = error instanceof ModelError ? error : new ModelError(String(error), MINUTE);
        this.cooldownUntil.set(model, this.now() + failure.cooldownMs);
        lastError = `${model}: ${failure.message}`;
        this.logger.warn(`Gemini model ${model} failed (${failure.message}); cooling down ${Math.round(failure.cooldownMs / 1000)}s.`);
      }
    }

    throw new GeminiUnavailableError(lastError);
  }

  private async callModel(model: string, system: string, turns: ChatTurn[], timeoutMs: number): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey as string },
        body: this.buildBody(system, turns),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new ModelError(aborted ? "timed out" : "network error", MINUTE);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) throw await this.classifyFailure(response);

    const data = (await response.json().catch(() => null)) as GeminiResponse | null;
    if (data?.promptFeedback?.blockReason) {
      throw new GeminiBlockedError(`blocked: ${data.promptFeedback.blockReason}`);
    }

    // "thought" parts are the model's internal reasoning — never show them.
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
      .trim();

    if (!text) {
      if (data?.candidates?.[0]?.finishReason === "SAFETY") throw new GeminiBlockedError("blocked: SAFETY");
      throw new ModelError("empty response", MINUTE);
    }
    return text;
  }

  private buildBody(system: string, turns: ChatTurn[]): string {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((turn) => ({
        role: turn.role,
        parts: [
          ...(turn.image ? [{ inlineData: { mimeType: turn.image.mimeType, data: turn.image.data } }] : []),
          { text: turn.text },
        ],
      })),
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: this.config.maxOutputTokens,
        thinkingConfig: { thinkingBudget: this.config.thinkingBudget },
      },
    });
  }

  /**
   * Like generate(), but hands each piece of the answer to `onText` the moment
   * Google produces it, so the customer sees words appear in real time
   * instead of waiting for the whole reply.
   *
   * Fallback works until the first word: a model that errors or stays silent
   * for firstTokenTimeoutMs is skipped for the next one. Once words have been
   * shown we stay with that model — if it then breaks off, the customer keeps
   * the (partial) answer rather than seeing it restart.
   */
  async generateStream(system: string, turns: ChatTurn[], onText: (delta: string) => void): Promise<GeminiResult> {
    if (!this.config.apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured.");

    const startedAt = this.now();
    let lastError = "no model available";

    for (const model of this.candidates()) {
      if (this.config.totalBudgetMs - (this.now() - startedAt) < 2_000) break;

      let started = false;
      let text = "";
      try {
        await this.streamModel(model, system, turns, (delta) => {
          started = true;
          text += delta;
          onText(delta);
        });
        return { text, model };
      } catch (error) {
        if (started && text) {
          // Words are already on the customer's screen — keep them.
          this.logger.warn(`Gemini model ${model} stopped mid-answer (${error instanceof Error ? error.message : error}).`);
          return { text, model };
        }
        if (error instanceof GeminiBlockedError) throw error;
        if (error instanceof KeyError) {
          this.logger.error(`Gemini rejected the API key (${error.message}). Check GEMINI_API_KEY.`);
          throw new GeminiUnavailableError("The AI provider rejected the API key.");
        }
        const failure = error instanceof ModelError ? error : new ModelError(String(error), MINUTE);
        this.cooldownUntil.set(model, this.now() + failure.cooldownMs);
        lastError = `${model}: ${failure.message}`;
        this.logger.warn(`Gemini model ${model} failed (${failure.message}); cooling down ${Math.round(failure.cooldownMs / 1000)}s.`);
      }
    }
    throw new GeminiUnavailableError(lastError);
  }

  private async streamModel(model: string, system: string, turns: ChatTurn[], onDelta: (delta: string) => void): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), this.config.firstTokenTimeoutMs);
    const overall = setTimeout(() => controller.abort(), this.config.streamTimeoutMs);

    try {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey as string },
          body: this.buildBody(system, turns),
          signal: controller.signal,
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new ModelError(aborted ? "no first word in time" : "network error", MINUTE);
      }
      if (!response.ok) throw await this.classifyFailure(response);
      if (!response.body) throw new ModelError("no response body", MINUTE);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotText = false;

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const delta = this.textFromEvent(rawEvent, gotText);
            if (delta) {
              if (!gotText) {
                gotText = true;
                clearTimeout(timer); // first word arrived — only the overall cap applies now
                timer = overall;
              }
              onDelta(delta);
            }
          }
        }
      } catch (error) {
        if (error instanceof GeminiBlockedError || error instanceof ModelError) throw error;
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new ModelError(aborted ? (gotText ? "stream timed out" : "no first word in time") : "stream interrupted", MINUTE);
      }
      // A trailing event without the final blank line.
      const last = this.textFromEvent(buffer, gotText);
      if (last) {
        gotText = true;
        onDelta(last);
      }
      if (!gotText) throw new ModelError("empty response", MINUTE);
    } finally {
      clearTimeout(timer);
      clearTimeout(overall);
    }
  }

  /** Pulls the visible text out of one SSE event, ignoring the model's hidden "thought" parts. */
  private textFromEvent(rawEvent: string, alreadyStarted: boolean): string {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) return "";

    let data: GeminiResponse;
    try {
      data = JSON.parse(dataLines.join("")) as GeminiResponse;
    } catch {
      return "";
    }
    if (data.promptFeedback?.blockReason && !alreadyStarted) {
      throw new GeminiBlockedError(`blocked: ${data.promptFeedback.blockReason}`);
    }
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    if (!text && candidate?.finishReason === "SAFETY" && !alreadyStarted) throw new GeminiBlockedError("blocked: SAFETY");
    return text;
  }

  private async classifyFailure(response: Response): Promise<Error> {
    const body = await response.text().catch(() => "");
    const status = response.status;

    if (status === 429) {
      // Per-day quota won't recover for hours; per-minute recovers quickly.
      const perDay = /PerDay|per day|daily/i.test(body);
      return new ModelError("quota exhausted", perDay ? 60 * MINUTE : 5 * MINUTE);
    }
    if (status === 404) return new ModelError("model not available to this key", 6 * 60 * MINUTE);
    if (status >= 500) return new ModelError(`server error ${status}`, MINUTE);
    if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid/i.test(body)) {
      return new KeyError(`HTTP ${status}`);
    }
    // Other 4xx (e.g. 400): a problem with this model/request, try the next one briefly later.
    return new ModelError(`request rejected ${status}`, 5 * MINUTE);
  }
}

class ModelError extends Error {
  constructor(
    message: string,
    readonly cooldownMs: number
  ) {
    super(message);
  }
}

class KeyError extends Error {}

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}
