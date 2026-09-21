import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPricingRate, type PricingRate } from "@/services/pricing.service";
import { subscribeLive } from "@/services/liveContent";
import { priceLabel, priceParts, type PriceParts } from "@/utils/price";

interface PricingContextValue {
  /** Kwacha per US dollar, or null until the first answer (prices then show in dollars only). */
  rate: number | null;
  roundTo: number;
  parts: (amount: number, currency: string) => PriceParts;
  label: (amount: number, currency: string) => string;
}

const PricingContext = createContext<PricingContextValue | null>(null);

/** How often an open page re-checks the exchange rate (the server itself caches it for 30 minutes). */
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Keeps the current exchange rate available to every price on the site.
 * It refreshes on its own every 10 minutes, whenever the tab comes back into view, and instantly when
 * an admin changes the currency settings — so kwacha amounts never go stale on a page left open.
 */
export function PricingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Pick<PricingRate, "rate" | "roundMwkTo">>({ rate: null, roundMwkTo: 1000 });

  const load = useCallback(() => {
    getPricingRate()
      .then((result) => setState({ rate: result.rate, roundMwkTo: result.roundMwkTo }))
      // Keep showing the last known rate if a refresh fails; dollar prices never depend on it.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    const stopLive = subscribeLive(["pricing"], load);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      stopLive();
    };
  }, [load]);

  const value = useMemo<PricingContextValue>(
    () => ({
      rate: state.rate,
      roundTo: state.roundMwkTo,
      parts: (amount, currency) => priceParts(amount, currency, state.rate, state.roundMwkTo),
      label: (amount, currency) => priceLabel(amount, currency, state.rate, state.roundMwkTo),
    }),
    [state]
  );

  return <PricingContext.Provider value={value}>{children}</PricingContext.Provider>;
}

export function usePricing(): PricingContextValue {
  const context = useContext(PricingContext);
  if (!context) throw new Error("usePricing must be used within a PricingProvider.");
  return context;
}
