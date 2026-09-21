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


describe("GeminiClient when every model is briefly overloaded", () => {
  it("makes one more pass instead of failing, and recovers", async () => {
    // Three models all answer 503 (a brief overload), then the first is healthy again.
    const { client, calls } = clientWith([fail(503), fail(503), fail(503), ok("recovered")]);
    const result = await client.generate("sys", turns);
    expect(result.text).toBe("recovered");
    expect(calls).toHaveLength(4);
  });

  it("gives up after that single extra pass", async () => {
    const { client, calls } = clientWith([fail(503), fail(503), fail(503), fail(503)]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError);
    // Pass 1 tries all three; pass 2 (all are resting) tries only the one that recovers soonest. Never a third pass.
    expect(calls).toHaveLength(4);
  });

  it("does NOT retry quota, missing-model or other non-overload failures", async () => {
    const { client, calls } = clientWith([fail(429), fail(404), fail(400)]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError);
    expect(calls).toHaveLength(3);
  });

  it("streams the same way: one more pass after a full overload", async () => {
    const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });
    const { client, calls } = clientWith([fail(503), fail(503), fail(503), sse("hello")]);
    const seen: string[] = [];
    const result = await client.generateStream("sys", turns, (d) => seen.push(d));
    expect(result.text).toBe("hello");
    expect(seen.join("")).toBe("hello");
    expect(calls).toHaveLength(4);
  });
});

describe("GeminiClient last-resort patience", () => {
  it("lets the final model take longer than the normal first-word deadline", async () => {
    const slowConfig: GeminiConfig = { ...config, models: ["fast", "slow"], firstTokenTimeoutMs: 30, lastResortFirstTokenTimeoutMs: 400 };
    let call = 0;
    const fetchFn = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      call++;
      // The first model never answers in time; the last one answers after 150ms — far past 30ms.
      const delay = call === 1 ? 5_000 : 150;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        init?.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(Object.assign(new Error("aborted"), { name: "AbortError" })); });
      });
      return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "slow but fine" }] } }] })}\n\n`, { status: 200 });
    });
    const client = new GeminiClient(fetchFn as unknown as typeof fetch, slowConfig);
    const result = await client.generateStream("sys", turns, () => undefined);
    expect(result).toEqual({ text: "slow but fine", model: "slow" });
  });
});

describe("GeminiClient search grounding", () => {
  const grounded = () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: "found it" }] },
            groundingMetadata: { groundingChunks: [{ web: { uri: "https://a.example/deal", title: "a.example" } }, { web: { uri: "https://a.example/deal", title: "a.example" } }, { web: { uri: "https://b.example/x" } }] },
          },
        ],
      }),
      { status: 200 }
    );

  it("asks Google Search to ground the answer only when requested", async () => {
    const { client, fetchFn } = clientWith([grounded(), ok("plain")]);
    await client.generate("sys", turns, { search: true });
    await client.generate("sys", turns);
    const bodies = fetchFn.mock.calls.map((call) => JSON.parse(String((call[1] as RequestInit).body)));
    expect(bodies[0].tools).toEqual([{ google_search: {} }]);
    expect(bodies[1].tools).toBeUndefined();
  });

  it("returns the pages it used, without duplicates", async () => {
    const { client } = clientWith([grounded()]);
    const result = await client.generate("sys", turns, { search: true });
    expect(result.sources).toEqual(["a.example (https://a.example/deal)", "https://b.example/x"]);
  });

  it("leaves sources off ordinary answers", async () => {
    const { client } = clientWith([ok("plain")]);
    expect((await client.generate("sys", turns)).sources).toBeUndefined();
  });
});

describe("GeminiClient racing", () => {
  const raceConfig: GeminiConfig = { ...config, models: ["slow", "fast"], hedgeDelayMs: 40, perAttemptTimeoutMs: 3_000, firstTokenTimeoutMs: 3_000 };
  const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200 });

  /** A fetch whose response time depends on which model is asked; cancelled requests reject like a real abort. */
  function fetchWithDelays(delays: Record<string, number>, make: (model: string) => Response) {
    const started: string[] = [];
    const cancelled: string[] = [];
    const fetchFn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const model = /models\/([^:]+):/.exec(String(url))![1];
      started.push(model);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delays[model]);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          cancelled.push(model);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
      return make(model);
    });
    return { fetchFn, started, cancelled };
  }

  it("starts the next model when the first is slow, and returns whichever answers first", async () => {
    const { fetchFn, started, cancelled } = fetchWithDelays({ slow: 1_500, fast: 20 }, (model) => ok(`from ${model}`));
    const client = new GeminiClient(fetchFn as unknown as typeof fetch, raceConfig);
    const started_at = Date.now();
    const result = await client.generate("sys", turns);
    expect(result).toMatchObject({ text: "from fast", model: "fast" });
    expect(Date.now() - started_at).toBeLessThan(600); // did not wait for the slow model
    expect(started).toEqual(["slow", "fast"]);
    expect(cancelled).toContain("slow");
  });

  it("does not blame or cool down a model that was only cancelled because another won", async () => {
    const { fetchFn } = fetchWithDelays({ slow: 1_500, fast: 20 }, (model) => ok(`from ${model}`));
    const client = new GeminiClient(fetchFn as unknown as typeof fetch, raceConfig);
    await client.generate("sys", turns);
    // "slow" was cancelled, not failed — so it must still be first in line next time.
    const second = fetchWithDelays({ slow: 10, fast: 10 }, (model) => ok(`from ${model}`));
    (client as unknown as { fetchFn: typeof fetch }).fetchFn = second.fetchFn as unknown as typeof fetch;
    expect((await client.generate("sys", turns)).model).toBe("slow");
  });

  it("does not start a second model at all when the first is quick", async () => {
    const { fetchFn, started } = fetchWithDelays({ slow: 5, fast: 5 }, (model) => ok(`from ${model}`));
    await new GeminiClient(fetchFn as unknown as typeof fetch, raceConfig).generate("sys", turns);
    expect(started).toEqual(["slow"]);
  });

  it("streams the first model to speak, and shows only that model's words", async () => {
    const { fetchFn } = fetchWithDelays({ slow: 300, fast: 20 }, (model) => sse(`words from ${model}`));
    const client = new GeminiClient(fetchFn as unknown as typeof fetch, raceConfig);
    const seen: string[] = [];
    const result = await client.generateStream("sys", turns, (delta) => seen.push(delta));
    expect(result.model).toBe("fast");
    expect(seen.join("")).toBe("words from fast");
  });
});

describe("GeminiClient request settings", () => {
  it("leaves the thinking setting out for 'lite' models (they reject it) and sends it to the others", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchFn = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return ok("fine");
    });
    for (const model of ["gemini-flash-lite-latest", "gemini-3.6-flash"]) {
      await new GeminiClient(fetchFn as unknown as typeof fetch, { ...config, models: [model] }).generate("sys", turns);
    }
    expect((bodies[0].generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
    expect((bodies[1].generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it("a search-quota failure never takes a model out of service for normal chat", async () => {
    const urls: string[] = [];
    const responses = [fail(429), fail(429), ok("normal chat answer")];
    const fetchFn = jest.fn(async (url: string | URL | Request) => {
      urls.push(/models\/([^:]+):/.exec(String(url))![1]);
      return responses.shift() as Response;
    });
    const client = new GeminiClient(fetchFn as unknown as typeof fetch, { ...config, models: ["first", "second"] });
    await expect(client.generate("sys", turns, { search: true })).rejects.toBeInstanceOf(GeminiUnavailableError);
    // Both models hit the SEARCH quota. An ordinary chat must still start with "first" — not skip it as if it were broken.
    expect((await client.generate("sys", turns)).text).toBe("normal chat answer");
    expect(urls).toEqual(["first", "second", "first"]);
  });
});
