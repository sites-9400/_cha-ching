import { describe, expect, it } from "vitest";
import { categoryTotals, debtCurve, nextRelease } from "./stats";

describe("debtCurve", () => {
  it("reconstructs end-of-month balance from live total + later payments", () => {
    const pays = [
      { monthKey: "2026-07", amount: 300 },
      { monthKey: "2026-08", amount: 200 },
      { monthKey: "2026-08", amount: 100 }, // Aug total 300
    ];
    expect(debtCurve(1000, pays)).toEqual([
      { month: "2026-07", balance: 1300 }, // 1000 + Aug's 300
      { month: "2026-08", balance: 1000 }, // 1000 + nothing later
    ]);
  });
  it("returns a single point when only one month has payments", () => {
    expect(debtCurve(500, [{ monthKey: "2026-07", amount: 200 }])).toEqual([
      { month: "2026-07", balance: 500 },
    ]);
  });
  it("returns empty with no payments", () => {
    expect(debtCurve(500, [])).toEqual([]);
  });
});

describe("categoryTotals", () => {
  const exps = [
    { amount: 500, category: "Food", date: "2026-07-16T10:00:00.000Z" },
    { amount: 200, category: "Food", date: "2026-07-04T10:00:00.000Z" },
    { amount: 300, category: "Transport", date: "2026-07-10T10:00:00.000Z" },
    { amount: 999, category: "Food", date: "2026-06-01T10:00:00.000Z" }, // other month
  ];
  it("sums this month's expenses per category, sorted descending", () => {
    expect(categoryTotals(exps, "2026-07")).toEqual([
      { category: "Food", total: 700 },
      { category: "Transport", total: 300 },
    ]);
  });
  it("is empty for a month with no expenses", () => {
    expect(categoryTotals(exps, "2026-09")).toEqual([]);
  });
});

describe("nextRelease", () => {
  it("finds the next release month on or after the current month", () => {
    expect(nextRelease([3, 6, 9, 12], 7)).toBe(9);
    expect(nextRelease([3, 6, 9, 12], 12)).toBe(12);
    expect(nextRelease([3, 6, 9, 12], 1)).toBe(3);
  });
  it("wraps to the earliest when none remain this year", () => {
    expect(nextRelease([3], 6)).toBe(3);
  });
  it("returns null when the fund never releases", () => {
    expect(nextRelease([], 5)).toBeNull();
  });
});
