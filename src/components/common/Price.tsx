import { usePricing } from "@/context/PricingContext";

interface PriceProps {
  amount: number;
  /** "USD" for current listings; older listings may still say "MWK". */
  currency: string;
  /** "stacked" (default): dollars, with the kwacha equivalent on a smaller line under. "inline": one line. */
  layout?: "stacked" | "inline";
}

/**
 * Draws a price the way the whole site shows money: US dollars first, with the equivalent in
 * Malawi kwacha at today's rate. Everything that displays a vehicle or hire price uses this, so
 * changing the format (or the rate) happens in one place.
 */
export default function Price({ amount, currency, layout = "stacked" }: PriceProps) {
  const { parts } = usePricing();
  const { main, approx } = parts(amount, currency);

  if (layout === "inline") {
    return (
      <span className="price price--inline">
        {main}
        {approx && <span className="price__approx"> ({approx})</span>}
      </span>
    );
  }
  return (
    <span className="price">
      <span className="price__main">{main}</span>
      {approx && <span className="price__approx">{approx}</span>}
    </span>
  );
}
