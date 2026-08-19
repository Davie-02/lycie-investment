import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;

/**
 * Calls onIdle once the user has gone `timeoutMs` without any mouse,
 * keyboard, scroll, or touch activity. Used to auto-logout the admin
 * dashboard after inactivity — separate from (and in addition to) the JWT's
 * own expiry, since a token can still be valid while someone's just walked
 * away from an unlocked computer.
 */
export function useIdleTimeout(timeoutMs: number, onIdle: () => void, enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onIdleRef.current(), timeoutMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [timeoutMs, enabled]);
}
