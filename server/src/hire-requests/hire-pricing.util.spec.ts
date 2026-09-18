import { calculateHireCost } from "./hire-pricing.util";

function daysFromNow(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("calculateHireCost", () => {
  const pickup = new Date("2026-01-01T09:00:00Z");

  it("charges daily rate x days when there is no weekly rate", () => {
    const result = calculateHireCost(50000, null, pickup, daysFromNow(pickup, 3));
    expect(result).toEqual({ days: 3, totalCost: 150000 });
  });

  it("treats a same-day pickup and return as a minimum of 1 day", () => {
    const result = calculateHireCost(50000, null, pickup, pickup);
    expect(result).toEqual({ days: 1, totalCost: 50000 });
  });

  it("uses the weekly rate for exactly 7 days when it's cheaper", () => {
    // 7 x daily (50000) = 350000, vs. weekly rate of 300000 — weekly wins.
    const result = calculateHireCost(50000, 300000, pickup, daysFromNow(pickup, 7));
    expect(result).toEqual({ days: 7, totalCost: 300000 });
  });

  it("blends a full week plus remaining days at the daily rate for 10 days", () => {
    // 10 x daily (50000) = 500000.
    // 1 week (300000) + 3 days (150000) = 450000 — blended wins.
    const result = calculateHireCost(50000, 300000, pickup, daysFromNow(pickup, 10));
    expect(result).toEqual({ days: 10, totalCost: 450000 });
  });

  it("falls back to the cheaper daily-only price when the weekly rate isn't actually a discount", () => {
    // 5 days: daily-only (250000) vs. blended (0 weeks + 5 days = 250000) — tied, still correct.
    // 7 days with a weekly rate that's *more* than 7 daily days should still pick daily-only.
    const result = calculateHireCost(50000, 400000, pickup, daysFromNow(pickup, 7));
    expect(result).toEqual({ days: 7, totalCost: 350000 });
  });

  it("rounds a fractional day difference to the nearest whole day", () => {
    const returnDate = new Date(pickup.getTime() + 2.4 * 24 * 60 * 60 * 1000);
    const result = calculateHireCost(50000, null, pickup, returnDate);
    expect(result.days).toBe(2);
  });
});
