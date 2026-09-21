import { priceText, toUsd, usdToMwk } from "./price-format";

describe("price formatting", () => {
  it("shows dollars first with the kwacha equivalent, rounded to the chosen step", () => {
    expect(priceText(26_000, "USD", 1750, 1000)).toBe("USD 26,000 (≈ MWK 45,500,000)");
    expect(priceText(35, "USD", 1751, 100)).toBe("USD 35 (≈ MWK 61,300)");
  });

  it("converts an old kwacha price to dollars first", () => {
    expect(toUsd(45_500_000, "MWK", 1750)).toBe(26_000);
    expect(priceText(45_500_000, "MWK", 1750, 1000)).toBe("USD 26,000 (≈ MWK 45,500,000)");
  });

  it("never invents a conversion when no rate is known", () => {
    expect(priceText(26_000, "USD", null)).toBe("USD 26,000");
    expect(priceText(45_500_000, "MWK", null)).toBe("MWK 45,500,000");
  });

  it("rounds kwacha to the requested step", () => {
    expect(usdToMwk(1, 1749, 1000)).toBe(2000);
    expect(usdToMwk(1, 1749, 1)).toBe(1749);
  });
});
