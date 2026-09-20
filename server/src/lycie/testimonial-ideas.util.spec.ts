import { Candidate, isTestimonialWorthy, rankScore } from "./testimonial-ideas.util";

const base: Candidate = {
  source: "review",
  sourceId: "1",
  text: "Lycie Investments sourced exactly the pickup I needed and kept me updated at every stage. Excellent service.",
  authorName: "Chikondi",
  rating: 5,
  sentimentScore: 0.8,
};

describe("isTestimonialWorthy", () => {
  it("accepts a clearly positive, substantial comment", () => {
    expect(isTestimonialWorthy(base)).toBe(true);
  });

  it("rejects short, long, lukewarm or low-rated feedback", () => {
    expect(isTestimonialWorthy({ ...base, text: "Great!" })).toBe(false);
    expect(isTestimonialWorthy({ ...base, text: "good ".repeat(120) })).toBe(false);
    expect(isTestimonialWorthy({ ...base, sentimentScore: 0.1 })).toBe(false);
    expect(isTestimonialWorthy({ ...base, rating: 3 })).toBe(false);
  });

  it("rejects text containing personal details or links", () => {
    expect(isTestimonialWorthy({ ...base, text: base.text + " Call me on 0991 383 466" })).toBe(false);
    expect(isTestimonialWorthy({ ...base, text: base.text + " mail me a@b.com" })).toBe(false);
    expect(isTestimonialWorthy({ ...base, text: base.text + " see https://x.example" })).toBe(false);
  });

  it("accepts an unrated comment if it is positive enough", () => {
    expect(isTestimonialWorthy({ ...base, source: "comment", rating: null })).toBe(true);
  });
});

describe("rankScore", () => {
  it("ranks stronger, fuller feedback higher", () => {
    const strong = rankScore(base);
    const weaker = rankScore({ ...base, rating: 4, sentimentScore: 0.3, text: "Good service, quick and friendly staff." });
    expect(strong).toBeGreaterThan(weaker);
    expect(strong).toBeLessThanOrEqual(1);
  });
});
