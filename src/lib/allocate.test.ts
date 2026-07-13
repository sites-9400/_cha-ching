import { describe, expect, it } from "vitest";
import { allocateCutoff, cutoffForDueDay } from "./allocate";
import type { Debt } from "./types";

const D = (over: Partial<Debt>): Debt => ({
  id: over.name ?? "x", name: "x", startingBalance: 0, currentBalance: 0,
  payoffOrder: 0, channel: "RCBC", isBNPL: false, active: true, ...over,
});

// Real July data, payoff order: REVI(1) < Classic(2) < Gold(3), plus a BNPL laptop.
const debtsJuly = (over: Record<string, Partial<Debt>> = {}): Debt[] => [
  D({ id: "revi", name: "REVI", payoffOrder: 1, currentBalance: 17265, dueDay: 16, channel: "CIMB", ...over.revi }),
  D({ id: "classic", name: "RCBC Classic", payoffOrder: 2, currentBalance: 6337, dueDay: 4, ...over.classic }),
  D({ id: "gold", name: "RCBC Gold", payoffOrder: 3, currentBalance: 44871, dueDay: 28, ...over.gold }),
  D({ id: "laptop", name: "Laptop", payoffOrder: 9, currentBalance: 51995, isBNPL: true, ...over.laptop }),
];

describe("cutoffForDueDay", () => {
  it("maps due days to cutoffs incl. boundaries", () => {
    expect(cutoffForDueDay(16)).toBe(1);
    expect(cutoffForDueDay(28)).toBe(2);
    expect(cutoffForDueDay(4)).toBe(2);
    expect(cutoffForDueDay(10)).toBe(2);
    expect(cutoffForDueDay(24)).toBe(1);
    expect(cutoffForDueDay(25)).toBe(2);
    expect(cutoffForDueDay(12)).toBe(2);
    expect(cutoffForDueDay(13)).toBe(1);
    expect(cutoffForDueDay(undefined)).toBe(2);
  });
});

describe("allocateCutoff", () => {
  it("1st cutoff July: single target line REVI 15,933", () => {
    const a = allocateCutoff(15933, debtsJuly(), 1);
    expect(a.shortfall).toBe(0);
    expect(a.lines).toHaveLength(1);
    expect(a.lines[0]).toMatchObject({ debtId: "revi", amount: 15933, kind: "target" });
    expect(a.lines[0].minIncluded).toBeUndefined();
  });

  it("2nd cutoff July: one merged line per debt in payoff order", () => {
    // REVI down to 1,332 after 1st cutoff; only Gold's minimum (1,090) is set.
    const debts = debtsJuly({
      revi: { currentBalance: 1332 },
      gold: { currentBalance: 26339, minimum: 1090 },
    });
    const a = allocateCutoff(34008, debts, 2);
    expect(a.shortfall).toBe(0);
    expect(a.lines.map((l) => l.debtId)).toEqual(["revi", "classic", "gold"]);
    expect(a.lines[0]).toMatchObject({ amount: 1332, kind: "target" });
    expect(a.lines[1]).toMatchObject({ debtId: "classic", amount: 6337, kind: "spill" });
    expect(a.lines[2]).toMatchObject({ debtId: "gold", amount: 26339, kind: "spill", minIncluded: 1090 });
    expect(a.lines.reduce((s, l) => s + l.amount, 0)).toBe(34008);
  });

  it("tight month: free cash only covers minimums → no target line", () => {
    // free cash == the one required minimum; nothing spills to the target.
    const debts = debtsJuly({ gold: { minimum: 1090 } });
    const a = allocateCutoff(1090, debts, 2);
    expect(a.shortfall).toBe(0);
    expect(a.lines).toEqual([
      expect.objectContaining({ debtId: "gold", amount: 1090, kind: "minimum" }),
    ]);
    expect(a.lines.some((l) => l.kind === "target")).toBe(false);
  });

  it("short month: free cash < minimums → shortfall, no negative amounts", () => {
    const debts = debtsJuly({ gold: { minimum: 1090 } });
    const a = allocateCutoff(400, debts, 2);
    expect(a.shortfall).toBe(690); // 1090 - 400
    expect(a.lines.every((l) => l.amount >= 0)).toBe(true);
    expect(a.lines.reduce((s, l) => s + l.amount, 0)).toBeLessThanOrEqual(400);
  });

  it("excludes BNPL debts from allocation entirely", () => {
    const a = allocateCutoff(999999, debtsJuly(), 2);
    expect(a.lines.some((l) => l.debtId === "laptop")).toBe(false);
  });
});
