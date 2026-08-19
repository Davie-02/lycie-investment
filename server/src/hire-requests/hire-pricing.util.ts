const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface HirePricingResult {
  days: number;
  totalCost: number;
}

/**
 * Automatically picks the cheaper of two pricing strategies:
 *   - plain daily rate × number of days
 *   - full weeks at the weekly rate + remaining days at the daily rate
 *     (only considered if the vehicle has a weekly rate at all)
 *
 * This mirrors how real vehicle hire pricing works — a customer hiring for
 * 10 days automatically gets 1 week + 3 days priced at the better rate,
 * without needing to know to ask for it.
 *
 * Deliberately day-granularity only (not hourly) — the site's hire vehicles
 * only have daily/weekly rates today. Hourly pricing would need a real rate
 * field on HireVehicle first; adding it later wouldn't require changing this
 * function's shape, just extending it.
 */
export function calculateHireCost(
  dailyRate: number,
  weeklyRate: number | null | undefined,
  pickupDate: Date,
  returnDate: Date
): HirePricingResult {
  const rawDays = Math.round((returnDate.getTime() - pickupDate.getTime()) / MS_PER_DAY);
  const days = Math.max(1, rawDays); // same-day hire still counts as 1 day

  const dailyOnlyCost = days * dailyRate;

  if (!weeklyRate) {
    return { days, totalCost: dailyOnlyCost };
  }

  const fullWeeks = Math.floor(days / 7);
  const remainderDays = days % 7;
  const weeklyBlendedCost = fullWeeks * weeklyRate + remainderDays * dailyRate;

  return { days, totalCost: Math.min(dailyOnlyCost, weeklyBlendedCost) };
}
