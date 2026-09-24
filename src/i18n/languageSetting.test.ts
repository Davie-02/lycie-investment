import { describe, expect, it } from "vitest";
import { effectiveLanguageSetting } from "./LanguageContext";

const defaults = { allowVisitorSwitch: true, defaultLanguage: "en" as const };

describe("effectiveLanguageSetting", () => {
  it("never shows the switch before the settings arrive on a first visit", () => {
    expect(effectiveLanguageSetting(false, null, defaults).allowVisitorSwitch).toBe(false);
  });

  it("uses the remembered setting while loading, so a disabled switch stays hidden", () => {
    const off = { allowVisitorSwitch: false, defaultLanguage: "ny" as const };
    expect(effectiveLanguageSetting(false, off, defaults)).toEqual(off);
  });

  it("uses the remembered setting while loading when switching is allowed", () => {
    expect(effectiveLanguageSetting(false, defaults, defaults).allowVisitorSwitch).toBe(true);
  });

  it("keeps a disabled switch hidden even if the server can't be reached", () => {
    const off = { allowVisitorSwitch: false, defaultLanguage: "en" as const };
    // Not loaded (request failed): the built-in default would allow switching, but the remembered "off" wins.
    expect(effectiveLanguageSetting(false, off, defaults).allowVisitorSwitch).toBe(false);
  });

  it("follows the real setting once it has arrived", () => {
    const off = { allowVisitorSwitch: false, defaultLanguage: "en" as const };
    expect(effectiveLanguageSetting(true, defaults, off)).toEqual(off);
  });
});
