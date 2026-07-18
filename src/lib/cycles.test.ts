import { describe, expect, it } from "vitest";
import { currentCycleKey, cycleDates, cycleMinimums, daysUntil, paidInCycle } from "./cycles";

const pay = (debtId: string, date: string, amount: number) => ({ debtId, date, amount });

describe("currentCycleKey", () => {
  it("uses this month once the statement day has arrived", () => {
    expect(currentCycleKey(15, new Date(2026, 6, 15))).toBe("2026-07");
    expect(currentCycleKey(15, new Date(2026, 6, 20))).toBe("2026-07");
  });
  it("uses last month before the statement day", () => {
    expect(currentCycleKey(15, new Date(2026, 6, 14))).toBe("2026-06");
  });
  it("crosses the year boundary", () => {
    expect(currentCycleKey(15, new Date(2026, 0, 5))).toBe("2025-12");
  });
  it("clamps the statement day in short months", () => {
    // statementDay 31 in June (30 days) → statement on Jun 30
    expect(currentCycleKey(31, new Date(2026, 5, 30))).toBe("2026-06");
  });
});

describe("cycleDates", () => {
  it("puts the due date in the same month when it falls after the statement", () => {
    expect(cycleDates(5, 20, "2026-07")).toEqual({ statementDate: "2026-07-05", dueDate: "2026-07-20" });
  });
  it("rolls the due date to the next month when on/before the statement day", () => {
    // EastWest: statement 15th, due 10th → due the following month
    expect(cycleDates(15, 10, "2026-07")).toEqual({ statementDate: "2026-07-15", dueDate: "2026-08-10" });
  });
  it("clamps both days in short months", () => {
    expect(cycleDates(31, 31, "2026-02")).toEqual({ statementDate: "2026-02-28", dueDate: "2026-03-31" });
  });
});

describe("paidInCycle", () => {
  const payments = [
    pay("d1", "2026-07-14T10:00:00.000Z", 111), // day before window
    pay("d1", "2026-07-15T10:00:00.000Z", 500), // window start (inclusive)
    pay("d1", "2026-08-14T10:00:00.000Z", 200), // last day of window
    pay("d1", "2026-08-15T10:00:00.000Z", 333), // next window (exclusive)
    pay("d2", "2026-07-20T10:00:00.000Z", 999), // other debt
  ];
  it("sums payments in [statement, next statement)", () => {
    expect(paidInCycle(payments, "d1", 15, "2026-07")).toBe(700);
  });
});

describe("daysUntil", () => {
  it("counts whole days ignoring time of day", () => {
    expect(daysUntil("2026-07-20", new Date(2026, 6, 18, 23, 59))).toBe(2);
    expect(daysUntil("2026-07-18", new Date(2026, 6, 18))).toBe(0);
    expect(daysUntil("2026-07-16", new Date(2026, 6, 18))).toBe(-2);
  });
});

describe("cycleMinimums", () => {
  const debts = [{ id: "d1", statementDay: 15 }, { id: "d2", statementDay: 15 }, { id: "d3" }];
  const cycles = [
    { id: "2026-07", debtId: "d1", minimumDue: 1700 },
    { id: "2026-07", debtId: "d2", minimumDue: 1000 },
  ];
  const today = new Date(2026, 6, 18); // cycle key 2026-07

  it("nets the cycle minimum against payments already in the cycle", () => {
    const m = cycleMinimums(debts, cycles, [pay("d1", "2026-07-16T00:00:00.000Z", 500)], today);
    expect(m.get("d1")).toBe(1200);
    expect(m.get("d2")).toBe(1000);
  });
  it("floors at zero when the minimum is already covered", () => {
    const m = cycleMinimums(debts, cycles, [pay("d1", "2026-07-16T00:00:00.000Z", 9999)], today);
    expect(m.get("d1")).toBe(0);
  });
  it("has no entry without a statementDay or without a cycle doc", () => {
    const m = cycleMinimums(debts, [cycles[0]], [], today);
    expect(m.has("d2")).toBe(false); // no cycle doc entered yet → static fallback applies downstream
    expect(m.has("d3")).toBe(false); // no statementDay
  });
});
