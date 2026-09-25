/**
 * Groq — the backup AI provider (free tier, no card). Used only when Gemini can't
 * answer (daily quota used up, overloaded, or no Gemini key), and only for plain
 * text: Lycie's chat and the writing tools. Web-search tasks (deals finder,
 * briefings) and reading images stay with Gemini, which is the only one that
 * can do them here.
 *
 * Groq speaks the OpenAI "chat completions" format. Models are tried in order
 * (GROQ_MODELS, fastest first); one that fails rests for a while, like Gemini's.
 */
import { Logger } from "@nestjs/common";

export interface GroqConfig {
  apiKey: string | undefined;
  models: string[];
  maxOutputTokens: number;
  timeoutMs: number;
  firstTokenTimeoutMs: number;
  streamTimeoutMs: number;
}

// gpt-oss-20b is the quickest of Groq's free chat models; 120b is stronger if 20b is busy.
const DEFAULT_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];
const URL = "https://api.groq.com/openai/v1/chat/completions";
const MINUTE = 60_000;

export function readGroqConfig(env: NodeJS.ProcessEnv = process.env): GroqConfig {
  const models = (env.GROQ_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return {
    apiKey: env.GROQ_API_KEY?.trim() || undefined,
    models: models.length ? models : DEFAULT_MODELS,
    maxOutputTokens: Number(env.LYCIE_MAX_OUTPUT_TOKENS) || 700,
    timeoutMs: 20_000,
    firstTokenTimeoutMs: 12_000,
    streamTimeoutMs: 40_000,
  };
}

export interface GroqTurn {
  role: "user" | "model";
  text: string;
}

/** Why a Groq model couldn't answer; `restMs` = how long to leave it alone. */
export class GroqError extends Error {
  constructor(
    message: string,
    readonly restMs: number,
    readonly keyProblem = false
  ) {
    super(message);
  }
}

type FetchFn = typeof fetch;

export class GroqClient {
  private readonly logger = new Logger("GroqClient");
  private readonly restUntil = new Map<string, number>();
  /** Models that rejected the optional reasoning settings (sent without them from then on). */
  private readonly plainOnly = new Set<string>();

  constructor(
    private readonly config: GroqConfig,
    private readonly fetchFn: FetchFn,
    private readonly now: () => number = () => Date.now()
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  get models(): string[] {
    return this.config.models;
  }

  /** Every model not resting; if all are resting, the one that recovers soonest. */
  private chain(): string[] {
    const now = this.now();
    const ready = this.config.models.filter((m) => (this.restUntil.get(m) ?? 0) <= now);
    return ready.length ? ready : [...this.config.models].sort((a, b) => (this.restUntil.get(a) ?? 0) - (this.restUntil.get(b) ?? 0)).slice(0, 1);
  }

  private body(model: string, system: string, turns: GroqTurn[], options: { maxOutputTokens?: number; temperature?: number }, stream: boolean) {
    const reasoning = /gpt-oss/i.test(model) && !this.plainOnly.has(model);
    const maxTokens = options.maxOutputTokens ?? this.config.maxOutputTokens;
    return JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...turns.map((t) => ({ role: t.role === "model" ? "assistant" : "user", content: t.text }))],
      temperature: options.temperature ?? 0.4,
      // Reasoning models spend part of the allowance thinking; keep the thinking short and leave room for the answer.
      max_tokens: reasoning ? maxTokens + 800 : maxTokens,
      stream,
      ...(reasoning ? { reasoning_effort: "low", include_reasoning: false } : {}),
    });
  }

  private async request(model: string, body: string, signal: AbortSignal): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` },
        body,
        signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new GroqError(aborted ? "timed out" : "network error", 20_000);
    }
    if (response.ok) return response;
    const text = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) throw new GroqError(`key rejected (HTTP ${response.status})`, 60 * MINUTE, true);
    if (response.status === 429) throw new GroqError("quota exhausted", /day|RPD|TPD/i.test(text) ? 60 * MINUTE : 2 * MINUTE);
    if (response.status === 404) throw new GroqError("model not available", 6 * 60 * MINUTE);
    if (response.status === 413) throw new GroqError("request too large for the free tier", 2 * MINUTE);
    if (response.status >= 500) throw new GroqError(`server error ${response.status}`, 20_000);
    // A 400 may just mean this model doesn't take the reasoning settings: remember, and let the caller retry once.
    if (response.status === 400 && /gpt-oss/i.test(model) && !this.plainOnly.has(model) && /reasoning/i.test(text)) {
      this.plainOnly.add(model);
      throw new GroqError("retry without reasoning settings", 0);
    }
    throw new GroqError(`request rejected ${response.status}`, 5 * MINUTE);
  }

  /** Runs `attempt` on each model in turn until one answers. */
  private async tryModels<T>(attempt: (model: string) => Promise<T>): Promise<{ value: T; model: string }> {
    if (!this.config.apiKey) throw new GroqError("GROQ_API_KEY is not set", 0, true);
    let last = "no model available";
    for (const model of this.chain()) {
      for (let tries = 0; tries < 2; tries++) {
        try {
          return { value: await attempt(model), model };
        } catch (error) {
          const failure = error instanceof GroqError ? error : new GroqError(String(error), MINUTE);
          if (failure.restMs === 0 && !failure.keyProblem) continue; // retry this model once, plainly
          if (failure.keyProblem) {
            this.logger.error(`Groq rejected the API key (${failure.message}). Check GROQ_API_KEY.`);
            throw failure;
          }
          this.restUntil.set(model, this.now() + failure.restMs);
          last = `${model}: ${failure.message}`;
          this.logger.warn(`Groq model ${model} failed (${failure.message}); resting ${Math.round(failure.restMs / 1000)}s.`);
          break;
        }
      }
    }
    throw new GroqError(last, 0);
  }

  async generate(system: string, turns: GroqTurn[], options: { maxOutputTokens?: number; temperature?: number; timeoutMs?: number } = {}): Promise<{ text: string; model: string }> {
    const { value, model } = await this.tryModels(async (m) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.config.timeoutMs);
      try {
        const response = await this.request(m, this.body(m, system, turns, options, false), controller.signal);
        const data = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string | null } }> } | null;
        const text = data?.choices?.[0]?.message?.content?.trim() ?? "";
        if (!text) throw new GroqError("empty response", MINUTE);
        return text;
      } finally {
        clearTimeout(timer);
      }
    });
    return { text: value, model: `groq:${model}` };
  }

  /** Streams the answer word by word (OpenAI-style server-sent events). */
  async generateStream(system: string, turns: GroqTurn[], onText: (delta: string) => void): Promise<{ text: string; model: string }> {
    const { value, model } = await this.tryModels(async (m) => {
      const controller = new AbortController();
      let timer = setTimeout(() => controller.abort(), this.config.firstTokenTimeoutMs);
      const overall = setTimeout(() => controller.abort(), this.config.streamTimeoutMs);
      let text = "";
      try {
        const response = await this.request(m, this.body(m, system, turns, {}, true), controller.signal);
        if (!response.body) throw new GroqError("no response body", MINUTE);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          for (;;) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
            let newline: number;
            while ((newline = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              let delta = "";
              try {
                // Only the answer ("content"); any reasoning the model sends separately is never shown.
                delta = (JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string | null } }> }).choices?.[0]?.delta?.content ?? "";
              } catch {
                continue;
              }
              if (!delta) continue;
              if (!text) {
                clearTimeout(timer); // first word: only the overall cap applies now
                timer = overall;
              }
              text += delta;
              onText(delta);
            }
          }
        } catch (error) {
          if (text) return text; // words already shown: keep the partial answer
          const aborted = error instanceof Error && error.name === "AbortError";
          throw new GroqError(aborted ? "no first word in time" : "stream interrupted", 20_000);
        }
        if (!text) throw new GroqError("empty response", MINUTE);
        return text;
      } finally {
        clearTimeout(timer);
        clearTimeout(overall);
      }
    });
    return { text: value, model: `groq:${model}` };
  }

  /** Admin check: asks each model a tiny question. */
  async diagnose(): Promise<Array<{ model: string; ok: boolean; ms: number; problem?: string }>> {
    if (!this.config.apiKey) return [];
    return Promise.all(
      this.config.models.map(async (model) => {
        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
        const ping = () => this.request(model, this.body(model, "Reply with the single word: ok", [{ role: "user", text: "ping" }], { maxOutputTokens: 16 }, false), controller.signal);
        try {
          // A model that turned down the reasoning settings is asked again without them.
          await ping().catch((error) => (error instanceof GroqError && error.restMs === 0 && !error.keyProblem ? ping() : Promise.reject(error)));
          return { model: `groq:${model}`, ok: true, ms: Date.now() - started };
        } catch (error) {
          return { model: `groq:${model}`, ok: false, ms: Date.now() - started, problem: error instanceof GroqError ? error.message : "unexpected error" };
        } finally {
          clearTimeout(timer);
        }
      })
    );
  }
}
