import { describe, expect, it } from "vitest";
import { effectiveTheme, readThemePref } from "./theme";

describe("readThemePref", () => {
  it("accepts the three valid values", () => {
    expect(readThemePref("light")).toBe("light");
    expect(readThemePref("dark")).toBe("dark");
    expect(readThemePref("system")).toBe("system");
  });
  it("falls back to system for missing or corrupt values", () => {
    expect(readThemePref(null)).toBe("system");
    expect(readThemePref("")).toBe("system");
    expect(readThemePref("blue")).toBe("system");
  });
});

describe("effectiveTheme", () => {
  it("explicit prefs ignore the system setting", () => {
    expect(effectiveTheme("light", true)).toBe("light");
    expect(effectiveTheme("dark", false)).toBe("dark");
  });
  it("system follows the OS preference", () => {
    expect(effectiveTheme("system", true)).toBe("dark");
    expect(effectiveTheme("system", false)).toBe("light");
  });
});
