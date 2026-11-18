import { describe, expect, it } from "vitest";
import { cardColor } from "./cardColors";

describe("cardColor", () => {
  it("maps the named cards", () => {
    expect(cardColor("rcbc-gold")).toBe("#C9A227");
    expect(cardColor("maya-black")).toBe("#000000");
    expect(cardColor("chinabank-landers")).toBe("#C8102E");
    expect(cardColor("maribank-cc")).toBe("#F26B21");
  });
  it("maps families and falls back to undefined", () => {
    expect(cardColor("ew-inst-bruno-14650")).toBe("#6B2C91");
    expect(cardColor("eastwest")).toBe("#6B2C91");
    expect(cardColor("maya-loan-220k")).toBe("#00B464");
    expect(cardColor("unknown")).toBeUndefined();
    expect(cardColor(undefined)).toBeUndefined();
  });
});
