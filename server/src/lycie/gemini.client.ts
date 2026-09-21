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
  /**
   * Extra first-word patience for the LAST model in the chain. It is the last resort and is
   * often the slowest (measured ~13s), so cutting it off at the normal deadline made the
   * final fallback pointless. Defaults to 15s.
   */
  lastResortFirstTokenTimeoutMs?: number;
  /** Pause before one more pass when every model just failed with a brief server overload. Default 1.5s. */
  retryDelayMs?: number;
  /**
   * "Racing": if the current model hasn't answered after this long, the NEXT model is started too and
   * whichever answers first wins (the others are cancelled). Gemini's response time swings from 1s to
   * 12s on the very same model, so racing cuts the worst waits dramatically. 0/undefined = one at a time.
   */
  hedgeDelayMs?: number;
}

// Order matters: fastest first. Measured on a real key (typical answer, 3 runs each):
//   gemini-flash-lite-latest ~1.2s · 3.1-flash-lite ~2-4s · 3.6-flash ~2-5s · 3.8-flash 4-12s (slowest, most erratic).
// The "lite" models reject the `thinkingBudget: 0` setting (HTTP 400), so it is simply not sent to them
// (see thinkingFor). Override the whole list with LYCIE_CHAT_MODELS.
const DEFAULT_MODELS = ["gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.8-flash"];

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
    totalBudgetMs: 32_000,
    firstTokenTimeoutMs: 8_000,
    streamTimeoutMs: 40_000,
    lastResortFirstTokenTimeoutMs: 15_000,
    retryDelayMs: 1_500,
    hedgeDelayMs: number(env.LYCIE_HEDGE_MS, 1_200),
  };
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
  /** An image the model should look at (used to read uploaded pictures into knowledge). */
  image?: { mimeType: string; data: string };
}

/** Per-call overrides (defaults are tuned for short chat replies). */
export interface GenerateOptions {
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /**
   * Let the model search the live web (Google Search grounding) before answering. Used by the
   * admin-only deals finder and market briefing — never by public chat. The pages it used come
   * back in `sources`.
   */
  search?: boolean;
}

export interface GeminiResult {
  text: string;
  model: string;
  /** Web pages a search-grounded answer drew on, as "site (address)". Empty for ordinary answers. */
  sources?: string[];
}

/** Nothing could answer right now (quota, outage, timeouts, missing key). */
export class GeminiUnavailableError extends Error {}
/** Google declined to answer the prompt (safety block). Retrying elsewhere won't help. */
export class GeminiBlockedError extends Error {}

const MINUTE = 60_000;
/** How long a model rests after a slow or dropped request — being slow is not the same as being broken. */
const BRIEF = 20_000;

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
  private candidates(search = false): string[] {
    const now = this.now();
    const until = (model: string) => this.cooldownUntil.get(this.cooldownKey(model, search)) ?? 0;
    const ready = this.config.models.filter((model) => until(model) <= now);
    if (ready.length > 0) return ready;
    // Everything is resting (a brief overload can knock out all of them at once). A customer is better served by
    // racing them all again than by an instant "I'm having trouble" — soonest-to-recover first.
    return [...this.config.models].sort((a, b) => until(a) - until(b));
  }

  /**
   * Cooldowns are remembered per model, and separately for search-grounded requests: Google's search
   * quota is different from (and much smaller than) its normal quota, so "search is out of quota"
   * must never take a model out of service for Lycie's everyday chat.
   */
  private cooldownKey(model: string, search: boolean): string {
    return search ? `${model}|search` : model;
  }

  /** "Lite" models reject the thinking setting, so it is only sent to the others. */
  private thinkingFor(model: string): { thinkingConfig: { thinkingBudget: number } } | Record<string, never> {
    return /lite/i.test(model) ? {} : { thinkingConfig: { thinkingBudget: this.config.thinkingBudget } };
  }

  /**
   * A live health check for admins: asks EVERY configured model a tiny question, ignoring cooldowns, and
   * reports how each one responded. Shows in plain terms whether the key works, which models are out of
   * quota or overloaded, and how fast each is from this server.
   */
  async diagnose(): Promise<Array<{ model: string; ok: boolean; ms: number; problem?: string }>> {
    if (!this.config.apiKey) return [{ model: "(none)", ok: false, ms: 0, problem: "GEMINI_API_KEY is not set." }];
    return Promise.all(
      this.config.models.map(async (model) => {
        const startedAt = Date.now();
        try {
          await this.callModel(model, "Reply with the single word: ok", [{ role: "user", text: "ping" }], 15_000, { maxOutputTokens: 8 });
          return { model, ok: true, ms: Date.now() - startedAt };
        } catch (error) {
          const problem = error instanceof ModelError ? error.message : error instanceof KeyError ? "the API key was rejected" : error instanceof GeminiBlockedError ? "declined the test message" : "unexpected error";
          return { model, ok: false, ms: Date.now() - startedAt, problem };
        }
      })
    );
  }

  /** The effective, non-secret configuration (shown in the admin check). */
  get settings() {
    return { models: this.config.models, raceAfterMs: this.config.hedgeDelayMs ?? 0, firstWordDeadlineMs: this.config.firstTokenTimeoutMs };
  }

  get isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  async generate(system: string, turns: ChatTurn[], options?: GenerateOptions): Promise<GeminiResult> {
    if (!this.config.apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured.");

    const search = Boolean(options?.search);
    const startedAt = this.now();
    let lastError = "no model available";

    // Up to two passes: the second only when every model just failed with a BRIEF overload (5xx),
    // which is usually over within a second or two. Quota, key and blocked errors never retry.
    for (let pass = 0; pass < 2; pass++) {
      const remaining = this.config.totalBudgetMs - (this.now() - startedAt);
      if (remaining < 2_000) break;

      try {
        const { value, model } = await this.race(
          this.candidates(search),
          (model, controller) => this.callModel(model, system, turns, Math.min(options?.timeoutMs ?? this.config.perAttemptTimeoutMs, remaining), options, controller.signal),
          search,
          remaining
        );
        return { text: value.text, model, ...(value.sources.length ? { sources: value.sources } : {}) };
      } catch (error) {
        if (!(error instanceof RaceFailure)) throw error;
        lastError = error.message;
        if (!error.overloaded || !(await this.pauseBeforeRetry(startedAt))) break;
      }
    }

    throw new GeminiUnavailableError(lastError);
  }

  /** Waits briefly, then says whether there is still time in the budget for another pass. */
  private async pauseBeforeRetry(startedAt: number): Promise<boolean> {
    const delay = this.config.retryDelayMs ?? 0;
    if (this.config.totalBudgetMs - (this.now() - startedAt) < delay + 4_000) return false;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    return true;
  }

  /**
   * Tries the models in order and returns the first good answer.
   *
   * A model is abandoned and the next started when it FAILS (immediately) or, with racing on, when it
   * is still silent after `hedgeDelayMs` — but a slow model is not cancelled: it keeps running, and
   * whichever answers first wins while the rest are cancelled. Cancelled models are never blamed
   * (no cooldown). Blocked prompts and rejected keys end the whole race at once.
   */
  private race<T>(
    chain: string[],
    attempt: (model: string, controller: AbortController, all: Map<string, AbortController>) => Promise<T>,
    search: boolean,
    deadlineMs: number
  ): Promise<{ value: T; model: string }> {
    return new Promise((resolve, reject) => {
      if (chain.length === 0) return reject(new RaceFailure("no model available", false));

      const controllers = new Map<string, AbortController>();
      const timers: NodeJS.Timeout[] = [];
      const hedgeMs = this.config.hedgeDelayMs ?? 0;
      let launched = 0;
      let failed = 0;
      let settled = false;
      let lastError = "no model available";
      let overloaded = false;

      const settle = (finish: () => void) => {
        if (settled) return;
        settled = true;
        timers.forEach(clearTimeout);
        controllers.forEach((controller) => controller.abort());
        finish();
      };

      const launch = () => {
        if (settled || launched >= chain.length) return;
        const model = chain[launched++];
        const controller = new AbortController();
        controllers.set(model, controller);
        // If this model is slow, start the next one alongside it.
        if (hedgeMs > 0 && launched < chain.length) timers.push(setTimeout(launch, hedgeMs));

        attempt(model, controller, controllers).then(
          (value) => settle(() => resolve({ value, model })),
          (error) => {
            // Cancelled because another model already won (or the race ended): not this model's fault.
            if (settled || controller.signal.aborted) return;
            if (error instanceof GeminiBlockedError) return settle(() => reject(error));
            if (error instanceof KeyError) {
              this.logger.error(`Gemini rejected the API key (${error.message}). Check GEMINI_API_KEY.`);
              return settle(() => reject(new GeminiUnavailableError("The AI provider rejected the API key.")));
            }
            const failure = error instanceof ModelError ? error : new ModelError(String(error), MINUTE);
            this.cooldownUntil.set(this.cooldownKey(model, search), this.now() + failure.cooldownMs);
            lastError = `${model}: ${failure.message}`;
            overloaded = failure.message.startsWith("server error");
            this.logger.warn(`Gemini model ${model}${search ? " (search)" : ""} failed (${failure.message}); cooling down ${Math.round(failure.cooldownMs / 1000)}s.`);
            failed += 1;
            if (failed >= chain.length) return settle(() => reject(new RaceFailure(lastError, overloaded)));
            launch(); // don't wait for the timer: move straight on to the next model
          }
        );
      };

      timers.push(setTimeout(() => settle(() => reject(new RaceFailure(lastError === "no model available" ? "timed out" : lastError, overloaded))), deadlineMs));
      launch();
    });
  }

  private async callModel(model: string, system: string, turns: ChatTurn[], timeoutMs: number, options?: GenerateOptions, signal?: AbortSignal): Promise<{ text: string; sources: string[] }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Also stop if the race was won by another model.
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey as string },
        body: this.buildBody(system, turns, options, model),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      throw new ModelError(aborted ? "timed out" : "network error", BRIEF);
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
    return { text, sources: this.sourcesFrom(data) };
  }

  /** The web pages a search-grounded answer used (deduplicated), for staff reference only. */
  private sourcesFrom(data: GeminiResponse | null): string[] {
    const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const seen = new Set<string>();
    for (const chunk of chunks) {
      const web = chunk.web;
      if (web?.uri) seen.add(web.title ? `${web.title} (${web.uri})` : web.uri);
    }
    return [...seen];
  }

  private buildBody(system: string, turns: ChatTurn[], options: GenerateOptions | undefined, model: string): string {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((turn) => ({
        role: turn.role,
        parts: [
          ...(turn.image ? [{ inlineData: { mimeType: turn.image.mimeType, data: turn.image.data } }] : []),
          { text: turn.text },
        ],
      })),
      ...(options?.search ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        temperature: options?.temperature ?? 0.4,
        maxOutputTokens: options?.maxOutputTokens ?? this.config.maxOutputTokens,
        ...this.thinkingFor(model),
      },
    });
  }

  /**
   * Like generate(), but hands each piece of the answer to `onText` the moment
   * Google produces it, so the customer sees words appear in real time
   * instead of waiting for the whole reply.
   *
   * Models race for the FIRST WORD (see race()): the first to produce text wins, the others are
   * cancelled, and only the winner's words are ever shown. Once words are on screen we stay with
   * that model — if it then breaks off, the customer keeps the (partial) answer.
   */
  async generateStream(system: string, turns: ChatTurn[], onText: (delta: string) => void): Promise<GeminiResult> {
    if (!this.config.apiKey) throw new GeminiUnavailableError("GEMINI_API_KEY is not configured.");

    const startedAt = this.now();
    let lastError = "no model available";

    for (let pass = 0; pass < 2; pass++) {
      const remaining = this.config.totalBudgetMs - (this.now() - startedAt);
      if (remaining < 2_000) break;

      const chain = this.candidates();
      let winner: string | null = null;
      let text = "";

      try {
        const { value, model } = await this.race(
          chain,
          async (model, controller, all) => {
            // The final model in the chain gets longer to say its first word (see the config note).
            const isLastResort = chain.length > 1 && chain.indexOf(model) === chain.length - 1;
            const firstWordMs = isLastResort ? Math.max(this.config.firstTokenTimeoutMs, this.config.lastResortFirstTokenTimeoutMs ?? 0) : this.config.firstTokenTimeoutMs;

            let mine = "";
            try {
              await this.streamModel(
                model,
                system,
                turns,
                (delta) => {
                  if (winner === null) {
                    // First word of the race: this model wins; stop the others.
                    winner = model;
                    all.forEach((other, name) => name !== model && other.abort());
                  }
                  if (winner !== model) return; // a slower model that lost — its words are discarded
                  mine += delta;
                  text += delta;
                  onText(delta);
                },
                firstWordMs,
                controller.signal
              );
              return mine;
            } catch (error) {
              if (winner === model && mine) {
                // Words are already on the customer's screen — keep them.
                this.logger.warn(`Gemini model ${model} stopped mid-answer (${error instanceof Error ? error.message : error}).`);
                return mine;
              }
              throw error;
            }
          },
          false,
          remaining
        );
        return { text: value || text, model };
      } catch (error) {
        if (!(error instanceof RaceFailure)) throw error;
        lastError = error.message;
        if (!error.overloaded || !(await this.pauseBeforeRetry(startedAt))) break;
      }
    }
    throw new GeminiUnavailableError(lastError);
  }

  private async streamModel(model: string, system: string, turns: ChatTurn[], onDelta: (delta: string) => void, firstTokenTimeoutMs = this.config.firstTokenTimeoutMs, signal?: AbortSignal): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), firstTokenTimeoutMs);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const overall = setTimeout(() => controller.abort(), this.config.streamTimeoutMs);

    try {
      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.config.apiKey as string },
          body: this.buildBody(system, turns, undefined, model),
          signal: controller.signal,
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        throw new ModelError(aborted ? "no first word in time" : "network error", BRIEF);
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
        throw new ModelError(aborted ? (gotText ? "stream timed out" : "no first word in time") : "stream interrupted", BRIEF);
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
    // Server overloads are usually brief: rest the model for 20s, not a full minute.
    if (status >= 500) return new ModelError(`server error ${status}`, 20_000);
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

/** Every model in a race failed. `overloaded` = the last failure was a brief server-side overload, worth one more pass. */
class RaceFailure extends Error {
  constructor(
    message: string,
    readonly overloaded: boolean
  ) {
    super(message);
  }
}

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
  }>;
}
