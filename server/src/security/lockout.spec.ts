import { LOCK_DURATION_MS, MAX_FAILED_ATTEMPTS, isLocked, lockedMessage, stateAfterFailure } from "./lockout";

describe("lockout", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("counts failures without locking until the limit", () => {
    expect(stateAfterFailure(0, now)).toEqual({ failedLoginCount: 1, lockedUntil: null });
    expect(stateAfterFailure(MAX_FAILED_ATTEMPTS - 2, now).lockedUntil).toBeNull();
  });

  it("locks on the final allowed failure and restarts the count", () => {
    const state = stateAfterFailure(MAX_FAILED_ATTEMPTS - 1, now);
    expect(state.failedLoginCount).toBe(0);
    expect(state.lockedUntil?.getTime()).toBe(now.getTime() + LOCK_DURATION_MS);
  });

  it("treats a past lock as expired", () => {
    expect(isLocked(new Date(now.getTime() + 1000), now)).toBe(true);
    expect(isLocked(new Date(now.getTime() - 1000), now)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });

  it("words the wait in minutes, rounding up", () => {
    expect(lockedMessage(new Date(now.getTime() + 30_000), now)).toContain("1 minute,");
    expect(lockedMessage(new Date(now.getTime() + 14 * 60_000 + 1), now)).toContain("15 minutes");
  });
});
