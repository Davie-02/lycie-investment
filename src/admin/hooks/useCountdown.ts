import { useEffect, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function computeCountdown(target: Date): Countdown {
  const diffMs = target.getTime() - Date.now();
  const isPast = diffMs <= 0;
  const abs = Math.abs(diffMs);

  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((abs / (60 * 1000)) % 60);
  const seconds = Math.floor((abs / 1000) % 60);

  return { days, hours, minutes, seconds, isPast };
}

/**
 * Live countdown to (or since, if isPast) a target date, updating every
 * second. Used for the booking detail view's "time until pickup" /
 * "time remaining on hire" display.
 */
export function useCountdown(target: Date): Countdown {
  const [countdown, setCountdown] = useState<Countdown>(() => computeCountdown(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(computeCountdown(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  return countdown;
}
