import { describe, expect, it } from "vitest";
import { resolveTheme } from "./theme";

const config = { defaultTheme: "ocean" as const, allowVisitorSwitch: true, followDeviceDarkMode: false };

describe("resolveTheme", () => {
  it("uses the admin's theme by default", () => {
    expect(resolveTheme(config, null, false)).toBe("ocean");
  });

  it("lets a visitor pick dark, and go back to the admin's theme", () => {
    expect(resolveTheme(config, "dark", false)).toBe("dark");
    expect(resolveTheme(config, "light", false)).toBe("ocean");
  });

  it("when the admin's theme is dark, 'light' falls back to Classic", () => {
    expect(resolveTheme({ ...config, defaultTheme: "dark" }, "light", false)).toBe("classic");
  });

  it("follows a dark device only when enabled and the visitor hasn't chosen", () => {
    expect(resolveTheme({ ...config, followDeviceDarkMode: true }, null, true)).toBe("dark");
    expect(resolveTheme(config, null, true)).toBe("ocean");
    expect(resolveTheme({ ...config, followDeviceDarkMode: true }, "light", true)).toBe("ocean");
  });

  it("ignores every visitor preference when the switch is off", () => {
    const locked = { ...config, allowVisitorSwitch: false, followDeviceDarkMode: true };
    expect(resolveTheme(locked, "dark", true)).toBe("ocean");
  });

  it("falls back to Classic for an unknown saved theme name", () => {
    expect(resolveTheme({ ...config, defaultTheme: "neon" as never }, null, false)).toBe("classic");
  });
});
