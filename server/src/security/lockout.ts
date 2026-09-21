/**
 * Account lockout after repeated wrong passwords.
 *
 * The per-IP rate limit (@Throttle on the login routes) stops one machine
 * hammering the form; lockout additionally stops a spread-out attack aimed at
 * a single account. Both admin and customer sign-in use these helpers so the
 * rule is defined once.
 *
 * State lives on the user row (failedLoginCount, lockedUntil).
 */

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface LockState {
  failedLoginCount: number;
  lockedUntil: Date | null;
}

/** Is the account currently locked? A lock in the past has simply expired. */
export function isLocked(lockedUntil: Date | null | undefined, now: Date = new Date()): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > now.getTime());
}

/** Wording shown to the person who is locked out. Says how long, and offers the way out. */
export function lockedMessage(lockedUntil: Date, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000));
  return `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`;
}

/**
 * The counters to save after one more wrong password. Reaching the limit
 * sets the lock and restarts the count, so when the lock ends the person
 * gets a fresh set of attempts rather than being locked again by the very
 * next typo.
 */
export function stateAfterFailure(currentCount: number, now: Date = new Date()): LockState {
  const next = currentCount + 1;
  if (next >= MAX_FAILED_ATTEMPTS) {
    return { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) };
  }
  return { failedLoginCount: next, lockedUntil: null };
}

/** The counters after a successful sign-in: everything forgiven. */
export const CLEARED_LOCK_STATE: LockState = { failedLoginCount: 0, lockedUntil: null };
