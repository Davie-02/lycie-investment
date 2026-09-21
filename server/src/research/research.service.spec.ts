import { HttpException } from "@nestjs/common";
import { GeminiUnavailableError, type GeminiClient } from "../lycie/gemini.client";
import { ResearchService } from "./research.service";
import { fetchHeadlines, type Headline } from "./web-search";

const headline = (n: number): Headline => ({ title: `Toyota Hilux clearance offer number ${n}`, url: `https://news.example/${n}`, domain: "news.example", seenAt: "2026-09-20T10:00:00.000Z" });
const request = { system: "sys", prompt: "find deals", headlineQuery: "hilux", allowKnowledge: false };

function build(generate: jest.Mock, news: Headline[] = [headline(1), headline(2)]) {
  const gemini = { isConfigured: true, generate } as unknown as GeminiClient;
  const service = new ResearchService(gemini);
  service.fetchNews = jest.fn(async () => news);
  return service;
}

describe("ResearchService", () => {
  beforeEach(() => delete process.env.GEMINI_SEARCH_GROUNDING);

  it("uses live web search when the plan allows it", async () => {
    const generate = jest.fn(async (..._args: unknown[]) => ({ text: "result", model: "m", sources: ["site (https://x)"] }));
    const answer = await build(generate).ask(request);
    expect(answer).toEqual({ text: "result", sources: ["site (https://x)"], mode: "web-search" });
    expect(generate.mock.calls[0][2]).toMatchObject({ search: true });
  });

  it("falls back to news headlines when search is out of quota — and remembers, so it doesn't retry search each time", async () => {
    const generate = jest.fn().mockRejectedValueOnce(new GeminiUnavailableError("m: quota exhausted")).mockResolvedValue({ text: "from headlines", model: "m" });
    const service = build(generate);
    const first = await service.ask(request);
    expect(first.mode).toBe("headlines");
    expect(first.sources).toEqual(["news.example (https://news.example/1)", "news.example (https://news.example/2)"]);
    await service.ask(request);
    // 1 failed search + 2 plain calls: the second ask skipped search entirely.
    expect(generate).toHaveBeenCalledTimes(3);
    expect((generate.mock.calls[2][2] as Record<string, unknown>).search).toBeUndefined();
  });

  it("puts the headlines in the prompt as data and forbids inventing beyond them", async () => {
    const generate = jest.fn().mockRejectedValueOnce(new GeminiUnavailableError("quota exhausted")).mockResolvedValue({ text: "x", model: "m" });
    await build(generate).ask(request);
    const [system, turns] = generate.mock.calls[1] as [string, Array<{ text: string }>];
    expect(system).toMatch(/NO web access/);
    expect(turns[0].text).toContain("Toyota Hilux clearance offer number 1");
  });

  it("never invents deals: refuses when there is no search and no headlines", async () => {
    const generate = jest.fn().mockRejectedValue(new GeminiUnavailableError("quota exhausted"));
    await expect(build(generate, []).ask(request)).rejects.toBeInstanceOf(HttpException);
  });

  it("lets the market briefing fall back to general knowledge, labelled as such", async () => {
    const generate = jest.fn().mockRejectedValueOnce(new GeminiUnavailableError("quota exhausted")).mockResolvedValue({ text: "knowledge answer", model: "m" });
    const answer = await build(generate, []).ask({ ...request, allowKnowledge: true });
    expect(answer).toEqual({ text: "knowledge answer", sources: [], mode: "knowledge" });
  });

  it("does not hide a genuine 'busy' error behind the fallback", async () => {
    const generate = jest.fn().mockRejectedValue(new GeminiUnavailableError("m: server error 503"));
    await expect(build(generate).ask(request)).rejects.toBeInstanceOf(GeminiUnavailableError);
  });

  it("can skip live search entirely", async () => {
    process.env.GEMINI_SEARCH_GROUNDING = "false";
    const generate = jest.fn(async (..._args: unknown[]) => ({ text: "plain", model: "m" }));
    expect((await build(generate).ask(request)).mode).toBe("headlines");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("reuses headlines for half an hour instead of asking GDELT again", async () => {
    process.env.GEMINI_SEARCH_GROUNDING = "false";
    const service = build(jest.fn(async (..._args: unknown[]) => ({ text: "x", model: "m" })));
    await service.ask(request);
    await service.ask(request);
    expect(service.fetchNews).toHaveBeenCalledTimes(1);
  });
});

describe("ResearchService — a news source that isn't answering", () => {
  it("is asked once, then skipped for a few minutes so the admin gets a fast answer", async () => {
    process.env.GEMINI_SEARCH_GROUNDING = "false";
    const service = build(jest.fn(async (..._args: unknown[]) => ({ text: "x", model: "m" })), []);
    await expect(service.ask(request)).rejects.toBeInstanceOf(HttpException);
    await expect(service.ask(request)).rejects.toBeInstanceOf(HttpException);
    expect(service.fetchNews).toHaveBeenCalledTimes(1);
    delete process.env.GEMINI_SEARCH_GROUNDING;
  });
});

describe("fetchHeadlines", () => {
  const body = { articles: [
    { title: "Toyota announces big Hilux discount for African buyers", url: "https://a.example/1", domain: "a.example", seendate: "20260920T101500Z" },
    { title: "Toyota announces big Hilux discount for African buyers", url: "https://b.example/1", domain: "b.example", seendate: "20260920T111500Z" },
    { title: "short", url: "https://c.example", domain: "c.example" },
    { title: "Valid headline with a bad link goes nowhere", url: "javascript:alert(1)", domain: "d.example" },
  ] };

  it("keeps real, distinct headlines and drops junk", async () => {
    const fetchFn = jest.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    const items = await fetchHeadlines("q", fetchFn as unknown as typeof fetch);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ domain: "a.example", seenAt: "2026-09-20T10:15:00.000Z" });
  });

  it("returns an empty list on rate limiting or network errors instead of throwing", async () => {
    expect(await fetchHeadlines("q", (async () => new Response("slow down", { status: 429 })) as unknown as typeof fetch)).toEqual([]);
    expect(await fetchHeadlines("q", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual([]);
  });
});
