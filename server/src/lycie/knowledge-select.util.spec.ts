import { KnowledgeItem, selectKnowledge } from "./knowledge-select.util";

const item = (title: string, content: string): KnowledgeItem => ({ title, category: "faq", content });

describe("selectKnowledge", () => {
  it("includes everything when it fits the budget", () => {
    const items = [item("Hire deposit", "A deposit is required."), item("Import time", "About 8 weeks.")];
    expect(selectKnowledge(items, "unrelated question", 10_000)).toEqual(items);
  });

  it("prefers relevant items when over budget", () => {
    const relevant = item("Import time", "Importing from Japan takes about 8 weeks.");
    const irrelevant = item("Opening hours", "We open Monday to Friday. ".repeat(20));
    const chosen = selectKnowledge([irrelevant, relevant], "how long does importing take", 150);
    expect(chosen).toEqual([relevant]);
  });

  it("puts database full-text matches first", () => {
    const a = item("Payment", "Pay by bank transfer. ".repeat(3));
    const b = item("Import", "Import steps. ".repeat(3));
    const chosen = selectKnowledge([a, b], "import steps", 100, [b]);
    expect(chosen).toEqual([b]);
  });

  it("never exceeds the budget", () => {
    const big = Array.from({ length: 10 }, (_, i) => item(`Entry ${i}`, "import ".repeat(50)));
    const chosen = selectKnowledge(big, "import", 1000);
    const size = chosen.reduce((s, i) => s + i.title.length + i.category.length + i.content.length + 12, 0);
    expect(size).toBeLessThanOrEqual(1000);
  });
});

import { bestKnowledgeMatch } from "./knowledge-select.util";

describe("bestKnowledgeMatch", () => {
  const items = [
    { title: "How long does clearing take at the border?", category: "faq", content: "Usually 3 to 7 working days." },
    { title: "What are your opening hours?", category: "faq", content: "Monday to Friday, 8 to 5." },
    { title: "Do you import cars from Japan?", category: "faq", content: "Yes, we do." },
  ];

  it("finds the FAQ that says the same thing in different words", () => {
    expect(bestKnowledgeMatch(items, "how long does clearing take?", 0.5)?.item.content).toBe("Usually 3 to 7 working days.");
    expect(bestKnowledgeMatch(items, "Do you import cars from japan", 0.5)?.item.content).toBe("Yes, we do.");
  });

  it("scores an identical question as a perfect match", () => {
    expect(bestKnowledgeMatch(items, "What are your opening hours?")?.score).toBe(1);
  });

  it("does not match unrelated questions", () => {
    expect(bestKnowledgeMatch(items, "Can I pay by mobile money?", 0.4)).toBeNull();
  });

  it("can require several shared words, so a single coincidence never counts", () => {
    expect(bestKnowledgeMatch(items, "Can I see your clearing agent?", 0.1, 1)?.item.title).toContain("clearing");
    expect(bestKnowledgeMatch(items, "Can I see your clearing agent?", 0.1, 2)).toBeNull();
  });

  it("returns null for a question with no meaningful words", () => {
    expect(bestKnowledgeMatch(items, "??? the of a")).toBeNull();
  });
});
