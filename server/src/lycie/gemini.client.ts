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
}

const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];

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
  };
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
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

  get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async generate(system: string, turns: ChatTurn[]): Promise<GeminiResult> {
    if (!this.config.apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured.");

    const startedAt = this.now();
    let lastError = "no model available";

    for (const model of this.config.models) {
      if ((this.cooldownUntil.get(model) ?? 0) > this.now()) continue;

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
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: this.config.maxOutputTokens,
            thinkingConfig: { thinkingBudget: this.config.thinkingBudget },
          },
        }),
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
