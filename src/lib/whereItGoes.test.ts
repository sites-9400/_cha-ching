import { describe, expect, it } from "vitest";
import { groupOutflow } from "./whereItGoes";
import type { MonthLine } from "./types";

const line = (over: Partial<MonthLine> & { name: string; amount: number }): MonthLine => ({
  id: over.name, channel: "CASH", cutoff: 2, order: 0, status: "", oneOff: false, ...over,
});

describe("groupOutflow", () => {
  const lines: MonthLine[] = [
    line({ name: "Rent", amount: 10000 }),
    line({ name: "Chinabank", amount: 15000, debtId: "d1" }),
    line({ name: "Split card", amount: 5000, debtSplits: [{ debtId: "d2", amount: 5000 }] }),
    line({ name: "Emergency savings", amount: 3000 }),
    line({ name: "Allowance", amount: 8000, isEnvelope: true }),
    line({ name: "Grocery", amount: 2000, budgetGroup: "Food" }),
    line({ name: "Other cutoff", amount: 99999, cutoff: 1 }),
  ];

  it("buckets deterministically and ranks by amount desc", () => {
    const g = groupOutflow(lines, 2);
    expect(g.map((x) => [x.key, x.amount, x.count])).toEqual([
      ["cards", 20000, 2],
      ["allowance", 10000, 2],
      ["other", 10000, 1],
      ["savings", 3000, 1],
    ]);
  });

  it("debt wins over a savings name", () => {
    const g = groupOutflow([line({ name: "Savings loan", amount: 100, debtId: "x" })], 2);
    expect(g).toEqual([{ key: "cards", label: "Cards & debts", amount: 100, count: 1 }]);
  });

  it("drops zero groups and treats empty budgetGroup as none", () => {
    const g = groupOutflow([line({ name: "Water", amount: 500, budgetGroup: "" }), line({ name: "Zero", amount: 0, isEnvelope: true })], 2);
    expect(g.map((x) => x.key)).toEqual(["other"]);
  });

  it("uses an explicit group and keeps LINE_GROUPS order on ties", () => {
    const g = groupOutflow([
      line({ name: "Rent", amount: 500, group: "home" }),
      line({ name: "Netflix", amount: 500, group: "subscriptions" }),
      line({ name: "Mom", amount: 500, group: "family" }),
    ], 2);
    expect(g.map((x) => [x.key, x.label])).toEqual([["home", "Home"], ["family", "Family"], ["subscriptions", "Subscriptions"]]);
  });

  it("returns [] for an empty cutoff", () => {
    expect(groupOutflow(lines, 1).map((x) => x.key)).toEqual(["other"]);
    expect(groupOutflow([], 2)).toEqual([]);
  });
});

describe("groupOutflow month scope", () => {
  it("combines both cutoffs", () => {
    const ls = [
      { id: "a", name: "Rent", amount: 100, cutoff: 1, channel: "CIMB", order: 1, status: "", oneOff: false, group: "home" },
      { id: "b", name: "Bills", amount: 50, cutoff: 2, channel: "CIMB", order: 2, status: "", oneOff: false, group: "home" },
    ] as unknown as Parameters<typeof groupOutflow>[0];
    expect(groupOutflow(ls, "month")).toEqual([{ key: "home", label: "Home", amount: 150, count: 2 }]);
    expect(groupOutflow(ls, 1)[0].amount).toBe(100);
  });
});
