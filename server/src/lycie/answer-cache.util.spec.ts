import { AnswerCache, normalizeQuestion } from "./answer-cache.util";

describe("normalizeQuestion", () => {
  it("treats punctuation, case and spacing differences as the same question", () => {
    expect(normalizeQuestion("How much is the  Hilux??")).toBe("how much is the hilux");
    expect(normalizeQuestion("how much is the hilux")).toBe("how much is the hilux");
  });
});

describe("AnswerCache", () => {
  it("returns a stored answer for the same question asked differently", () => {
    const cache = new AnswerCache<string>();
    cache.set("Do you import from Japan?", "Yes.");
    expect(cache.get("do you import from japan")).toBe("Yes.");
  });

  it("expires answers after the time limit", () => {
    let time = 0;
    const cache = new AnswerCache<string>(1000, 10, () => time);
    cache.set("opening hours", "8 to 5");
    time = 999;
    expect(cache.get("opening hours")).toBe("8 to 5");
    time = 1001;
    expect(cache.get("opening hours")).toBeUndefined();
  });

  it("keeps only the newest entries when full", () => {
    const cache = new AnswerCache<number>(60_000, 3);
    ["aaa", "bbb", "ccc", "ddd"].forEach((q, i) => cache.set(q, i));
    expect(cache.size).toBe(3);
    expect(cache.get("aaa")).toBeUndefined();
    expect(cache.get("ddd")).toBe(3);
  });

  it("ignores vague one-word chatter and can be emptied", () => {
    const cache = new AnswerCache<string>();
    cache.set("hi", "hello");
    expect(cache.size).toBe(0);
    cache.set("where are you", "Lilongwe");
    cache.clear();
    expect(cache.get("where are you")).toBeUndefined();
  });
});
