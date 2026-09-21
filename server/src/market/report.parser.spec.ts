import { parseReport } from "./report.parser";

const good = {
  headline: "Compact Japanese hatchbacks and double-cab pickups lead demand.",
  trending: [{ name: "Toyota Hilux", why: "Fits rural and business use.", typicalPriceUsd: 24000 }],
  opportunities: [{ action: "Offer a fixed-price import package", why: "Buyers fear hidden costs." }],
  standOut: [{ idea: "Publish the full landed cost up front", why: "Transparency builds trust." }],
};

describe("parseReport", () => {
  it("reads a well-formed briefing, even inside code fences", () => {
    const report = parseReport("```json\n" + JSON.stringify(good) + "\n```");
    expect(report?.headline).toContain("Compact");
    expect(report?.trending[0]).toEqual({ name: "Toyota Hilux", why: "Fits rural and business use.", typicalPriceUsd: 24000 });
  });

  it("drops malformed entries and absurd prices but keeps the rest", () => {
    const report = parseReport(JSON.stringify({ ...good, trending: [{ name: "", why: "x" }, { name: "Honda Fit", why: "y", typicalPriceUsd: -3 }, "junk"] }));
    expect(report?.trending).toEqual([{ name: "Honda Fit", why: "y", typicalPriceUsd: null }]);
  });

  it("rejects replies with nothing usable, or that aren't JSON", () => {
    expect(parseReport("I could not find anything")).toBeNull();
    expect(parseReport("{not json}")).toBeNull();
    expect(parseReport(JSON.stringify({ headline: "only a headline" }))).toBeNull();
  });

  it("caps very long text", () => {
    const report = parseReport(JSON.stringify({ ...good, headline: "x".repeat(2000) }));
    expect(report?.headline).toHaveLength(300);
  });
});
