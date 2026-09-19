import { DailyCounter, WindowLimiter } from "./limits.util";

describe("WindowLimiter", () => {
  it("allows up to the limit then blocks, per key", () => {
    const time = 0;
    const limiter = new WindowLimiter(2, 1000, () => time);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
  });

  it("resets after the window", () => {
    let time = 0;
    const limiter = new WindowLimiter(1, 1000, () => time);
    limiter.allow("a");
    expect(limiter.allow("a")).toBe(false);
    time = 1001;
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("DailyCounter", () => {
  it("resets when the day changes", () => {
    let date = new Date("2026-09-19T10:00:00");
    const counter = new DailyCounter(() => date);
    counter.set(5);
    counter.increment();
    expect(counter.value).toBe(6);
    date = new Date("2026-09-20T00:01:00");
    expect(counter.value).toBe(0);
  });
});
