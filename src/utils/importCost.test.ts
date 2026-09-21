import { describe, expect, it } from "vitest";
import { estimateImportCost } from "./importCost";
import type { ImportCalculatorContent } from "@/types/siteContent";

const config: ImportCalculatorContent = {
  enabled: true,
  heading: "h",
  intro: "i",
  disclaimer: "d",
  origins: [{ name: "Japan", shippingUsd: 1000 }, { name: "South Africa", shippingUsd: 500 }],
  dutyPercent: 20,
  vatPercent: 10,
  clearingFeeUsd: 300,
  serviceFeePercent: 5,
  deliveryUsd: 200,
};

describe("estimateImportCost", () => {
  it("adds up every cost, taxing the vehicle plus shipping", () => {
    // CIF 11,000 → duty 2,200 → VAT (13,200 × 10%) 1,320 → fee 500 → 10,000+1,000+2,200+1,320+300+500+200
    expect(estimateImportCost(10_000, "Japan", config)).toEqual({
      vehiclePrice: 10000, shipping: 1000, duty: 2200, vat: 1320, clearing: 300, serviceFee: 500, delivery: 200, total: 15520,
    });
  });

  it("uses the shipping cost of the chosen country", () => {
    expect(estimateImportCost(10_000, "South Africa", config)?.shipping).toBe(500);
  });

  it("returns nothing for a missing price, a bad number or an unknown country", () => {
    expect(estimateImportCost(0, "Japan", config)).toBeNull();
    expect(estimateImportCost(NaN, "Japan", config)).toBeNull();
    expect(estimateImportCost(5000, "Mars", config)).toBeNull();
  });

  it("supports zero rates without producing NaN", () => {
    const free = { ...config, dutyPercent: 0, vatPercent: 0, serviceFeePercent: 0, clearingFeeUsd: 0, deliveryUsd: 0 };
    expect(estimateImportCost(8000, "Japan", free)?.total).toBe(9000);
  });
});
