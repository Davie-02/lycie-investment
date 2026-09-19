/**
 * Fixed-window counter per key (used per IP). In-memory on purpose: the
 * short-term @Throttle guard stops bursts, this stops slow drip abuse of a
 * free-tier AI quota. A restart resets it, which is acceptable for an
 * abuse guard (the global daily cap is DB-backed).
 */
export class WindowLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Records a hit; returns false when the key is over its limit. */
  allow(key: string): boolean {
    const time = this.now();
    if (this.hits.size > 5_000) this.prune(time);

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= time) {
      this.hits.set(key, { count: 1, resetAt: time + this.windowMs });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  private prune(time: number): void {
    for (const [key, entry] of this.hits) if (entry.resetAt <= time) this.hits.delete(key);
  }
}

/** Counts events for the current calendar day (server-local). */
export class DailyCounter {
  private day = "";
  private count = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  private roll(): void {
    const today = this.now().toDateString();
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
  }

  /** Seed from the database on first use after a restart. */
  get seeded(): boolean {
    this.roll();
    return this.count > 0;
  }

  set(value: number): void {
    this.roll();
    this.count = value;
  }

  get value(): number {
    this.roll();
    return this.count;
  }

  increment(): void {
    this.roll();
    this.count += 1;
  }
}
