import { GeminiBlockedError, GeminiClient, GeminiConfig, GeminiUnavailableError } from "./gemini.client";

const config: GeminiConfig = {
  apiKey: "test-key",
  models: ["m1", "m2", "m3"],
  thinkingBudget: 0,
  maxOutputTokens: 100,
  perAttemptTimeoutMs: 1_000,
  totalBudgetMs: 25_000,
  firstTokenTimeoutMs: 200,
  streamTimeoutMs: 2_000,
};

const ok = (text: string, extraParts: object[] = []) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [...extraParts, { text }] } }] }), { status: 200 });
const fail = (status: number, body = "{}") => new Response(body, { status });

function clientWith(responses: Array<Response | Error>) {
  const calls: string[] = [];
  const fetchFn = jest.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    calls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra call");
    if (next instanceof Error) throw next;
    return next;
  });
  const client = new GeminiClient(fetchFn as unknown as typeof fetch, config);
  return { client, calls, fetchFn };
}

const turns = [{ role: "user" as const, text: "hi" }];

describe("GeminiClient", () => {
  it("returns the first model's answer", async () => {
    const { client, calls } = clientWith([ok("hello")]);
    await expect(client.generate("sys", turns)).resolves.toEqual({ text: "hello", model: "m1" });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/models/m1:generateContent");
  });

  it("sends the key in a header, never the URL", async () => {
    const { client, calls, fetchFn } = clientWith([ok("hi")]);
    await client.generate("sys", turns);
    expect(calls[0]).not.toContain("test-key");
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "x-goog-api-key": "test-key" });
  });

  it("drops internal 'thought' parts", async () => {
    const { client } = clientWith([ok("answer", [{ text: "secret reasoning", thought: true }])]);
    expect((await client.generate("sys", turns)).text).toBe("answer");
  });

  it("falls back on 503 and remembers the failing model", async () => {
    const { client, calls } = clientWith([fail(503), ok("from m2"), ok("second question")]);
    expect((await client.generate("sys", turns)).model).toBe("m2");
    // m1 is cooling down, so the next question goes straight to m2.
    await client.generate("sys", turns);
    expect(calls.map((c) => c.match(/models\/(\w+):/)?.[1])).toEqual(["m1", "m2", "m2"]);
  });

  it("retries a cooled-down model once its cooldown ends", async () => {
    const { client, calls } = clientWith([fail(503), ok("m2"), ok("m1 again")]);
    let time = 1_000_000;
    client.now = () => time;
    await client.generate("sys", turns);
    time += 61_000;
    expect((await client.generate("sys", turns)).model).toBe("m1");
    expect(calls).toHaveLength(3);
  });

  it("holds a per-day quota failure for much longer than a per-minute one", async () => {
    const { client, calls } = clientWith([
      fail(429, '{"error":{"message":"Quota exceeded ... PerDay ..."}}'),
      ok("m2"),
      ok("m2 again"),
    ]);
    let time = 1_000_000;
    client.now = () => time;
    await client.generate("sys", turns);
    time += 30 * 60_000;
    await client.generate("sys", turns);
    expect(calls.map((c) => c.match(/models\/(\w+):/)?.[1])).toEqual(["m1", "m2", "m2"]);
  });

  it("stops the chain when the key is rejected", async () => {
    const { client, calls } = clientWith([fail(403)]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(calls).toHaveLength(1);
  });

  it("does not retry other models when the prompt is blocked", async () => {
    const blocked = new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 });
    const { client, calls } = clientWith([blocked]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiBlockedError);
    expect(calls).toHaveLength(1);
  });

  it("treats network errors and empty answers as failures and moves on", async () => {
    const empty = new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), { status: 200 });
    const { client } = clientWith([new Error("ECONNRESET"), empty, ok("m3 answer")]);
    expect((await client.generate("sys", turns)).model).toBe("m3");
  });

  it("throws GeminiUnavailableError when every model fails", async () => {
    const { client } = clientWith([fail(503), fail(429), fail(404)]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });

  it("throws immediately without a configured key", async () => {
    const client = new GeminiClient(jest.fn() as unknown as typeof fetch, { ...config, apiKey: undefined });
    expect(client.isConfigured).toBe(false);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });
});


describe("GeminiClient.generateStream", () => {
  const sse = (...texts: Array<string | object>) =>
    texts
      .map((t) => `data: ${JSON.stringify(typeof t === "string" ? { candidates: [{ content: { parts: [{ text: t }] } }] } : t)}\r\n\r\n`)
      .join("");

  /** A streaming Response that emits the given chunks, optionally then fails or stalls. */
  function streamResponse(chunks: string[], end: "close" | "error" | "stall" = "close", signal?: AbortSignal) {
    const encoder = new TextEncoder();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      // Chunks go out on the first read; an "error" ending fails on the NEXT read
      // (erroring inside start() would discard the queued chunks before they're read).
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
          if (end === "close") controller.close();
        } else if (end === "error") {
          controller.error(new Error("connection reset"));
        }
      },
      start(controller) {
        if (end === "stall") {
          signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            controller.error(err);
          });
        }
      },
    });
    return new Response(body, { status: 200 });
  }

  function clientFor(responses: Array<(signal?: AbortSignal) => Response>) {
    const calls: string[] = [];
    const fetchFn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url));
      const next = responses.shift();
      if (!next) throw new Error("unexpected extra call");
      return next(init?.signal as AbortSignal | undefined);
    });
    return { client: new GeminiClient(fetchFn as unknown as typeof fetch, config), calls };
  }

  it("delivers text piece by piece, split across network chunks, hiding thoughts", async () => {
    const event = sse("Hel") + sse({ candidates: [{ content: { parts: [{ text: "secret", thought: true }] } }] });
    const { client, calls } = clientFor([
      () => streamResponse([event.slice(0, 30), event.slice(30), sse("lo ", "world")]),
    ]);
    const pieces: string[] = [];
    const result = await client.generateStream("sys", turns, (d) => pieces.push(d));
    expect(pieces).toEqual(["Hel", "lo ", "world"]);
    expect(result).toEqual({ text: "Hello world", model: "m1" });
    expect(calls[0]).toContain(":streamGenerateContent?alt=sse");
  });

  it("falls back to the next model when the first fails before any words", async () => {
    const { client } = clientFor([() => fail(503), () => streamResponse([sse("from m2")])]);
    const pieces: string[] = [];
    const result = await client.generateStream("sys", turns, (d) => pieces.push(d));
    expect(result.model).toBe("m2");
    expect(pieces.join("")).toBe("from m2");
  });

  it("skips a model that stays silent past the first-word deadline", async () => {
    const { client } = clientFor([(signal) => streamResponse([], "stall", signal), () => streamResponse([sse("quick")])]);
    const result = await client.generateStream("sys", turns, () => undefined);
    expect(result).toEqual({ text: "quick", model: "m2" });
  });

  it("keeps a partial answer if the stream breaks after words were shown", async () => {
    const { client, calls } = clientFor([() => streamResponse([sse("Partial answer")], "error")]);
    const pieces: string[] = [];
    const result = await client.generateStream("sys", turns, (d) => pieces.push(d));
    expect(result).toEqual({ text: "Partial answer", model: "m1" });
    expect(calls).toHaveLength(1); // no restart on another model
  });

  it("surfaces a safety block without trying other models", async () => {
    const blocked = sse({ promptFeedback: { blockReason: "SAFETY" } });
    const { client, calls } = clientFor([() => streamResponse([blocked])]);
    await expect(client.generateStream("sys", turns, () => undefined)).rejects.toBeInstanceOf(GeminiBlockedError);
    expect(calls).toHaveLength(1);
  });

  it("throws unavailable when every model fails", async () => {
    const { client } = clientFor([() => fail(503), () => fail(429), () => fail(404)]);
    await expect(client.generateStream("sys", turns, () => undefined)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });
});


describe("GeminiClient when every model is cooling down", () => {
  it("still tries the one that recovers soonest instead of failing instantly", async () => {
    const responses = [fail(503), fail(503), fail(503), ok("recovered")];
    const calls: string[] = [];
    const fetchFn = jest.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      calls.push(String(url));
      return responses.shift() as Response;
    });
    const client = new GeminiClient(fetchFn as unknown as typeof fetch, config);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError); // all three fail and cool down
    const retry = await client.generate("sys", turns); // no model is "ready", but one is still attempted
    expect(retry.text).toBe("recovered");
    expect(calls).toHaveLength(4);
  });
});
