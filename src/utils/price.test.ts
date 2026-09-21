import { describe, expect, it } from "vitest";
import { priceLabel, priceParts, toUsd, usdToMwk } from "./price";

describe("price display", () => {
  it("shows dollars with the kwacha equivalent", () => {
    expect(priceParts(26000, "USD", 1750)).toEqual({ main: "$26,000", approx: "≈ MWK 45,500,000" });
    expect(priceLabel(26000, "USD", 1750)).toBe("$26,000 (≈ MWK 45,500,000)");
  });

  it("rounds the kwacha to the chosen step", () => {
    expect(usdToMwk(1, 1749, 1000)).toBe(2000);
    expect(priceParts(35, "USD", 1751, 100).approx).toBe("≈ MWK 61,300");
  });

  it("converts old kwacha prices to dollars for display", () => {
    expect(toUsd(45_500_000, "MWK", 1750)).toBe(26000);
    expect(priceLabel(45_500_000, "MWK", 1750)).toBe("$26,000 (≈ MWK 45,500,000)");
  });

  it("never guesses when no rate is known", () => {
    expect(priceLabel(26000, "USD", null)).toBe("$26,000");
    expect(priceLabel(45_500_000, "MWK", null)).toBe("MWK 45,500,000");
  });
});
