import { MarkerFilter } from "./marker-filter.util";

function run(chunks: string[]): string {
  const filter = new MarkerFilter();
  return chunks.map((c) => filter.push(c)).join("") + filter.end();
}

describe("MarkerFilter", () => {
  it("passes ordinary text straight through", () => {
    expect(run(["Hello ", "there"])).toBe("Hello there");
  });

  it("removes a marker delivered whole", () => {
    expect(run(["[[NO_INFO]]I don't know."])).toBe("I don't know.");
  });

  it("removes a marker split across chunks at any point", () => {
    const text = "See this one: [[vehicle:toyota-hilux-2022]] — nice.";
    for (let cut = 1; cut < text.length; cut++) {
      expect(run([text.slice(0, cut), text.slice(cut)])).toBe("See this one:  — nice.");
    }
  });

  it("never shows a partial marker while streaming", () => {
    const filter = new MarkerFilter();
    expect(filter.push("Try [[veh")).toBe("Try ");
    expect(filter.push("icle:abc]]")).toBe("");
  });

  it("holds a lone bracket until it's known not to be a marker", () => {
    const filter = new MarkerFilter();
    expect(filter.push("a [")).toBe("a ");
    expect(filter.push("b] c")).toBe("[b] c");
  });

  it("drops an unfinished marker at the end", () => {
    expect(run(["Done. [[NO_"])).toBe("Done. ");
  });

  it("releases a long '[[' that never becomes a marker", () => {
    const long = "[[" + "x".repeat(80);
    expect(run([long])).toBe(long);
  });
});
