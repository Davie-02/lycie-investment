import { analyzeReview, analyzeText, extractKeywords } from "./sentiment.util";

describe("analyzeText", () => {
  it("labels clearly positive feedback as positive", () => {
    const result = analyzeText("Excellent service, very professional and helpful. Highly recommend!");
    expect(result.label).toBe("positive");
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("labels clearly negative feedback as negative", () => {
    const result = analyzeText("Terrible experience. The car arrived damaged and they were rude and slow.");
    expect(result.label).toBe("negative");
    expect(result.score).toBeLessThan(-0.5);
  });

  it("treats text with no sentiment words as neutral", () => {
    const result = analyzeText("I would like the price and the color options for the Hilux.");
    expect(result.label).toBe("neutral");
    expect(result.score).toBe(0);
  });

  it("flips sentiment when a negator precedes the word", () => {
    expect(analyzeText("The service was not good").label).toBe("negative");
    expect(analyzeText("It wasn't bad at all").score).toBeGreaterThan(0);
  });

  it("amplifies sentiment with an intensifier", () => {
    const plain = analyzeText("poor service");
    const intense = analyzeText("very poor service");
    expect(intense.score).toBeLessThan(plain.score);
  });

  it("keeps the score within -1..1 for extremely long or repetitive text", () => {
    const rave = "amazing ".repeat(200);
    const rant = "terrible ".repeat(200);
    expect(analyzeText(rave).score).toBeLessThanOrEqual(1);
    expect(analyzeText(rant).score).toBeGreaterThanOrEqual(-1);
  });

  it("handles empty text without throwing", () => {
    expect(analyzeText("").label).toBe("neutral");
  });
});

describe("analyzeReview", () => {
  it("never labels a 1-star review positive, even with polite text", () => {
    const result = analyzeReview("Thanks for the help, nice people, good office.", 1);
    expect(result.label).not.toBe("positive");
  });

  it("never labels a 5-star review negative", () => {
    const result = analyzeReview("Slow delivery but worth the wait.", 5);
    expect(result.label).toBe("positive");
  });

  it("lets a complaint-heavy 3-star review lean negative", () => {
    const result = analyzeReview("Terrible communication, rude staff, delayed twice.", 3);
    expect(result.score).toBeLessThan(0);
  });
});

describe("extractKeywords", () => {
  it("returns frequent meaningful words and skips stopwords and short words", () => {
    const keywords = extractKeywords("Delivery delivery was slow. The price was high, price too high.");
    expect(keywords).toContain("delivery");
    expect(keywords).toContain("price");
    expect(keywords).not.toContain("the");
    expect(keywords).not.toContain("was");
  });

  it("respects the limit", () => {
    const keywords = extractKeywords("alpha bravo charlie delta echo foxtrot golf hotel india juliet", 3);
    expect(keywords).toHaveLength(3);
  });
});
