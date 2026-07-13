import { describe, expect, it } from "vitest";
import { applyAllocation, projectMonthPlan, simulateBalances } from "./project";
import type { Debt, EventItem, Income, TemplateLine } from "./types";

const D = (o: Partial<Debt>): Debt => ({
  id: o.name ?? "x", name: "x", startingBalance: 0, currentBalance: 0,
  payoffOrder: 0, channel: "RCBC", isBNPL: false, active: true, ...o,
});

describe("applyAllocation", () => {
  it("subtracts each line's amount from its debt, flooring at 0", () => {
    const debts = [D({ id: "a", currentBalance: 1000 }), D({ id: "b", currentBalance: 500 })];
    const out = applyAllocation(debts, {
      lines: [
        { debtId: "a", name: "a", amount: 600, kind: "target", channel: "RCBC" },
        { debtId: "b", name: "b", amount: 900, kind: "spill", channel: "RCBC" },
      ],
      shortfall: 0,
    });
    expect(out.find((d) => d.id === "a")!.currentBalance).toBe(400);
    expect(out.find((d) => d.id === "b")!.currentBalance).toBe(0); // floored
  });
});

describe("simulateBalances", () => {
  it("folds each month's two cutoffs down the avalanche", () => {
    const debts = [D({ id: "revi", currentBalance: 1000, payoffOrder: 1 })];
    const out = simulateBalances(debts, [{ c1: 300, c2: 200 }]);
    expect(out[0].currentBalance).toBe(500); // 1000 − 300 − 200
  });
  it("is a no-op with no steps", () => {
    const debts = [D({ id: "revi", currentBalance: 1000 })];
    expect(simulateBalances(debts, [])[0].currentBalance).toBe(1000);
  });
});

describe("projectMonthPlan", () => {
  const template: TemplateLine[] = [
    { id: "inc-planned", name: "x", amount: 0, channel: "CIMB", cutoff: 1, order: 1 },
  ];
  const incomes: Income[] = [{ id: "i1", name: "Pay", amount: 20000, day: 13, cutoff: 1 }];
  const events: EventItem[] = [];
  const debts = [D({ id: "revi", name: "REVI", currentBalance: 50000, payoffOrder: 1 })];

  it("targets the projected free cash at the payoff-order debt, on simulated balances", () => {
    // one month between current (2026-07) and target (2026-09): 2026-08.
    // each month cutoff1 free cash = 20000 income − 0 planned = 20000; cutoff2 = 0.
    const r = projectMonthPlan("2026-09", "2026-07", debts, template, events, incomes);
    expect(r.free.c1).toBe(20000);
    // Aug applied 20000 → REVI 30000 at start of Sep; Sep c1 20000 → REVI line 20000.
    expect(r.alloc.c1.lines[0]).toMatchObject({ debtId: "revi", amount: 20000, kind: "target" });
  });
});
