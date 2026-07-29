import { describe, expect, it } from "vitest";
import { averagePaydown, categoryTotals, dailyTotals, debtCurve, nextRelease } from "./stats";

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

describe("dailyTotals", () => {
  const exps = [
    { amount: 500, date: "2026-07-16T10:00:00.000Z" },
    { amount: 200, date: "2026-07-16T18:00:00.000Z" },
    { amount: 300, date: "2026-07-04T10:00:00.000Z" },
    { amount: 999, date: "2026-06-01T10:00:00.000Z" }, // other month
  ];
  it("sums same-day expenses within the month", () => {
    expect(dailyTotals(exps, "2026-07")).toEqual(new Map([
      [16, 700],
      [4, 300],
    ]));
  });
  it("filters out expenses from other months", () => {
    const totals = dailyTotals(exps, "2026-07");
    expect(totals.has(1)).toBe(false);
  });
  it("returns an empty map for empty input", () => {
    expect(dailyTotals([], "2026-07")).toEqual(new Map());
  });
});

describe("averagePaydown", () => {
  const trackedIds = new Set(["a", "b"]);
  it("averages only tracked debts' months", () => {
    const pays = [
      { debtId: "a", monthKey: "2026-04", amount: 1000 },
      { debtId: "c", monthKey: "2026-04", amount: 9999 }, // untracked (e.g. BNPL)
      { debtId: "b", monthKey: "2026-05", amount: 500 },
    ];
    expect(averagePaydown(pays, trackedIds, "2026-07")).toBe((1000 + 500) / 2);
  });
  it("excludes the current (partial) month", () => {
    const pays = [
      { debtId: "a", monthKey: "2026-06", amount: 1000 },
      { debtId: "a", monthKey: "2026-07", amount: 50000 }, // current month, in progress
    ];
    expect(averagePaydown(pays, trackedIds, "2026-07")).toBe(1000);
  });
  it("takes the latest 3 distinct months", () => {
    const pays = [
      { debtId: "a", monthKey: "2026-01", amount: 100 },
      { debtId: "a", monthKey: "2026-02", amount: 200 },
      { debtId: "a", monthKey: "2026-03", amount: 300 },
      { debtId: "a", monthKey: "2026-04", amount: 400 },
    ];
    expect(averagePaydown(pays, trackedIds, "2026-07")).toBe((200 + 300 + 400) / 3);
  });
  it("falls back when there is no completed history", () => {
    expect(averagePaydown([], trackedIds, "2026-07", 3, 90164)).toBe(90164);
    const onlyCurrent = [{ debtId: "a", monthKey: "2026-07", amount: 500 }];
    expect(averagePaydown(onlyCurrent, trackedIds, "2026-07", 3, 90164)).toBe(90164);
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
