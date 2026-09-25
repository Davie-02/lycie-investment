import { GeminiBlockedError, GeminiClient, GeminiConfig, GeminiUnavailableError } from "./gemini.client";
import type { GroqConfig } from "./groq.client";

const gemini: GeminiConfig = {
  apiKey: "gem-key",
  models: ["m1"],
  thinkingBudget: 0,
  maxOutputTokens: 100,
  perAttemptTimeoutMs: 1_000,
  totalBudgetMs: 25_000,
  firstTokenTimeoutMs: 200,
  streamTimeoutMs: 2_000,
};
const groq: GroqConfig = { apiKey: "groq-key", models: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"], maxOutputTokens: 100, timeoutMs: 1_000, firstTokenTimeoutMs: 500, streamTimeoutMs: 2_000 };

const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
const groqOk = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const fail = (status: number, body = "{}") => new Response(body, { status });
const sse = (lines: string[]) => new Response(lines.map((l) => `data: ${l}\n\n`).join(""), { status: 200 });

function setup(responses: Array<Response | Error>, opts: { gemini?: Partial<GeminiConfig>; groq?: Partial<GroqConfig> } = {}) {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  const fetchFn = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? ""), headers: (init?.headers ?? {}) as Record<string, string> });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra call");
    if (next instanceof Error) throw next;
    return next;
  });
  const client = new GeminiClient(fetchFn as unknown as typeof fetch, { ...gemini, ...opts.gemini }, { ...groq, ...opts.groq });
  return { client, calls };
}

const turns = [{ role: "user" as const, text: "hi" }];

describe("Groq backup", () => {
  it("isn't used while Gemini answers", async () => {
    const { client, calls } = setup([geminiOk("from gemini")]);
    expect(await client.generate("sys", turns)).toMatchObject({ text: "from gemini", model: "m1" });
    expect(calls).toHaveLength(1);
  });

  it("answers when Gemini is out of quota, and Gemini is skipped while it rests", async () => {
    const { client, calls } = setup([fail(429, "PerDay"), groqOk("from groq"), groqOk("again")]);
    expect(await client.generate("sys", turns)).toEqual({ text: "from groq", model: "groq:openai/gpt-oss-20b" });
    expect(await client.generate("sys", turns)).toMatchObject({ text: "again" });
    expect(calls.map((c) => (c.url.includes("groq.com") ? "groq" : "gemini"))).toEqual(["gemini", "groq", "groq"]);
    // Bearer key in the header, chat format, reasoning kept short.
    expect(calls[1].headers.Authorization).toBe("Bearer groq-key");
    const body = JSON.parse(calls[1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.reasoning_effort).toBe("low");
  });

  it("is used alone when there's no Gemini key", async () => {
    const { client, calls } = setup([groqOk("only groq")], { gemini: { apiKey: undefined } });
    expect(client.isConfigured).toBe(true);
    expect(client.hasGemini).toBe(false);
    expect((await client.generate("sys", turns)).text).toBe("only groq");
    expect(calls[0].url).toContain("api.groq.com");
  });

  it("never re-asks a prompt Gemini blocked", async () => {
    const { client, calls } = setup([new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiBlockedError);
    expect(calls).toHaveLength(1);
  });

  it("never takes web-search or picture requests", async () => {
    const { client } = setup([fail(429, "PerDay")]);
    await expect(client.generate("sys", turns, { search: true })).rejects.toBeInstanceOf(GeminiUnavailableError);
    const pic = setup([fail(429, "PerDay")]);
    await expect(pic.client.generate("sys", [{ role: "user", text: "read", image: { mimeType: "image/png", data: "x" } }])).rejects.toBeInstanceOf(GeminiUnavailableError);
  });

  it("moves to the next Groq model on quota, and retries plainly if a model refuses the reasoning settings", async () => {
    const { client, calls } = setup([fail(429, "PerDay"), fail(400, '{"error":{"message":"reasoning_effort is not supported"}}'), groqOk("plain")], { groq: { models: ["openai/gpt-oss-20b"] } });
    expect((await client.generate("sys", turns)).text).toBe("plain");
    expect(JSON.parse(calls[2].body).reasoning_effort).toBeUndefined();
  });

  it("streams from Groq word by word, never showing its reasoning", async () => {
    const { client } = setup(
      [fail(429, "PerDay"), sse([JSON.stringify({ choices: [{ delta: { reasoning: "thinking…" } }] }), JSON.stringify({ choices: [{ delta: { content: "Hel" } }] }), JSON.stringify({ choices: [{ delta: { content: "lo" } }] }), "[DONE]"])],
      {}
    );
    const seen: string[] = [];
    const result = await client.generateStream("sys", turns, (d) => seen.push(d));
    expect(seen).toEqual(["Hel", "lo"]);
    expect(result).toEqual({ text: "Hello", model: "groq:openai/gpt-oss-20b" });
  });

  it("reports failure like Gemini does when both are down", async () => {
    const { client } = setup([fail(429, "PerDay"), fail(503), fail(503)]);
    await expect(client.generate("sys", turns)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });
});
