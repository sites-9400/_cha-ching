import { describe, expect, it } from "vitest";
import { cardColor, lineColor } from "./cardColors";

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

describe("lineColor", () => {
  it("prefers the debt colour, then the channel", () => {
    expect(lineColor("maya-black", "MAYA")).toBe("#000000");
    expect(lineColor(undefined, "CIMB")).toBe("#C8102E");
    expect(lineColor(undefined, "RCBC CREDIT")).toBe("#C9A227");
    expect(lineColor(undefined, "GCASH")).toBe("#007DFE");
    expect(lineColor(undefined, "CASH")).toBeUndefined();
  });
});
