const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface HirePricingResult {
  days: number;
  totalCost: number;
}

/**
 * Mirrors server/src/hire-requests/hire-pricing.util.ts exactly — kept as a
 * small intentional duplication rather than a shared package, since it's
 * one pure function and this project doesn't otherwise need a monorepo
 * setup. This copy is for a live estimate shown while filling out the form;
 * the actual charge is always (re)computed server-side on submission, so a
 * mismatch here would only ever show a wrong estimate, never a wrong charge.
 */
export function calculateHireCost(
  dailyRate: number,
  weeklyRate: number | null | undefined,
  pickupDate: Date,
  returnDate: Date
): HirePricingResult {
  const rawDays = Math.round((returnDate.getTime() - pickupDate.getTime()) / MS_PER_DAY);
  const days = Math.max(1, rawDays);

  const dailyOnlyCost = days * dailyRate;

  if (!weeklyRate) {
    return { days, totalCost: dailyOnlyCost };
  }

  const fullWeeks = Math.floor(days / 7);
  const remainderDays = days % 7;
  const weeklyBlendedCost = fullWeeks * weeklyRate + remainderDays * dailyRate;

  return { days, totalCost: Math.min(dailyOnlyCost, weeklyBlendedCost) };
}
