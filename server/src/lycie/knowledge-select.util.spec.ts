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
