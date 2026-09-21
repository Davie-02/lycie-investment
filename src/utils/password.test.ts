import { describe, expect, it } from "vitest";
import { checkPassword, generateStrongPassword, isCommonPassword } from "./password";

describe("checkPassword", () => {
  it("accepts a strong password and reports every rule as met", () => {
    const result = checkPassword("Harbour-Lantern-42");
    expect(result.acceptable).toBe(true);
    expect(result.rules.every((rule) => rule.met)).toBe(true);
  });

  it("names the rules that a weak password breaks", () => {
    const failed = checkPassword("abc").rules.filter((rule) => !rule.met).map((rule) => rule.id);
    expect(failed).toEqual(expect.arrayContaining(["length", "upper", "number"]));
  });

  it("rejects common passwords even when disguised", () => {
    expect(isCommonPassword("Password123!")).toBe(true);
    expect(checkPassword("Password123!").acceptable).toBe(false);
  });

  it("rejects a password containing the person's name or email", () => {
    expect(checkPassword("Chikondi-2026-Xy", ["Chikondi Banda"]).acceptable).toBe(false);
    expect(checkPassword("Harbour-Lantern-42", ["Chikondi Banda"]).acceptable).toBe(true);
  });

  it("scores longer, more varied passwords higher", () => {
    expect(checkPassword("").score).toBe(0);
    expect(checkPassword("abc").score).toBe(1);
    expect(checkPassword("Harbourlantern42").score).toBeGreaterThanOrEqual(2);
    expect(checkPassword("Harbour-Lantern-42!x").score).toBe(4);
  });
});

describe("generateStrongPassword", () => {
  it("always produces a password its own rules accept", () => {
    for (let i = 0; i < 200; i++) {
      const password = generateStrongPassword();
      expect(password).toHaveLength(16);
      expect(checkPassword(password).acceptable).toBe(true);
      expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
    }
  });

  it("is random — no repeats across many draws", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateStrongPassword()));
    expect(seen.size).toBe(200);
  });
});
