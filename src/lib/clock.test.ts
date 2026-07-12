import { describe, expect, it } from "vitest";
import { currentMonthKey, monthIndex, monthLabel } from "./clock";

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
