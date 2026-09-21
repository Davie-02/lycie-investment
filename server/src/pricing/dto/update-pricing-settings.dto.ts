import { IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";

/** Kwacha rounding steps an admin may choose ("show MWK to the nearest 1,000"). */
export const ROUNDING_STEPS = [1, 10, 100, 500, 1000, 5000, 10000];

/** Allowed body when an admin saves the currency settings. Anything else is rejected. */
export class UpdatePricingSettingsDto {
  /** "auto" = use the live exchange rate; "manual" = always use `manualRate`. */
  @IsIn(["auto", "manual"])
  mode!: "auto" | "manual";

  /** Kwacha per 1 US dollar, used when mode is "manual". */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1_000_000)
  manualRate?: number | null;

  /** Percent added on top of the live rate (e.g. 5 = 5% more kwacha per dollar). Negative lowers it. */
  @IsNumber()
  @Min(-20)
  @Max(100)
  marginPercent!: number;

  @IsIn(ROUNDING_STEPS)
  roundMwkTo!: number;
}
