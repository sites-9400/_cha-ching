import { describe, expect, it } from "vitest";
import { currentMonthKey, localIso, monthIndex, monthLabel } from "./clock";

describe("clock", () => {
  it("formats a Date to YYYY-MM", () => {
    expect(currentMonthKey(new Date("2026-07-13T00:00:00Z"))).toBe("2026-07");
    expect(currentMonthKey(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
  it("extracts a 1-12 month index from a key", () => {
    expect(monthIndex("2026-07")).toBe(7);
    expect(monthIndex("2026-12")).toBe(12);
  });
  it("renders a human month label", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
    expect(monthLabel("2027-02")).toBe("February 2027");
  });
});

describe("localIso", () => {
  it("formats local calendar parts with zero-padding", () => {
    const d = new Date(2026, 0, 5, 3, 7, 9); // Jan 5, 03:07:09 LOCAL
    expect(localIso(d)).toBe("2026-01-05T03:07:09");
  });
  it("keeps a pre-8am local time on the same local day (the UTC+8 bug)", () => {
    const d = new Date(2026, 7, 14, 1, 30, 0); // Aug 14, 1:30am local
    expect(localIso(d).slice(0, 10)).toBe("2026-08-14");
    expect(localIso(d).slice(8, 10)).toBe("14");
  });
});
