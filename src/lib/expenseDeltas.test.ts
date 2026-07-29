import { describe, expect, it } from "vitest";
import { expenseDeltas } from "./expenseDeltas";
import type { ExpenseInput } from "./types";

const EXP = (o: Partial<ExpenseInput>): ExpenseInput =>
  ({ amount: 100, category: "Food", channel: "CASH", note: "", date: "2026-07-20T12:00:00.000Z", ...o });

describe("expenseDeltas", () => {
  it("amount edit on a savings-funded expense adjusts savingsDelta by the difference", () => {
    const old = EXP({ fundedBySavings: true });
    expect(expenseDeltas(old, { amount: 150 })).toEqual({ savingsDelta: -50, debtOps: [] });
    expect(expenseDeltas(old, { amount: 60 })).toEqual({ savingsDelta: 40, debtOps: [] });
  });

  it("savings → none gives the full old amount back to savings", () => {
    const old = EXP({ fundedBySavings: true, amount: 100 });
    expect(expenseDeltas(old, { fundedBySavings: null })).toEqual({ savingsDelta: 100, debtOps: [] });
  });

  it("none → savings deducts the full new amount from savings", () => {
    const old = EXP({ amount: 100 });
    expect(expenseDeltas(old, { fundedBySavings: true })).toEqual({ savingsDelta: -100, debtOps: [] });
  });

  it("card amount edit adjusts the same debt by the difference", () => {
    const old = EXP({ paidWithDebtId: "revi", amount: 100 });
    expect(expenseDeltas(old, { amount: 150 })).toEqual({
      savingsDelta: 0, debtOps: [{ debtId: "revi", delta: 50 }],
    });
  });

  it("card A → card B reverses A and charges B", () => {
    const old = EXP({ paidWithDebtId: "revi", amount: 100 });
    expect(expenseDeltas(old, { paidWithDebtId: "classic" })).toEqual({
      savingsDelta: 0,
      debtOps: [{ debtId: "revi", delta: -100 }, { debtId: "classic", delta: 100 }],
    });
  });

  it("card → savings reverses the debt and deducts savings", () => {
    const old = EXP({ paidWithDebtId: "revi", amount: 100 });
    expect(expenseDeltas(old, { fundedBySavings: true, paidWithDebtId: null })).toEqual({
      savingsDelta: -100, debtOps: [{ debtId: "revi", delta: -100 }],
    });
  });

  it("savings → card gives savings back and charges the card", () => {
    const old = EXP({ fundedBySavings: true, amount: 100 });
    expect(expenseDeltas(old, { fundedBySavings: null, paidWithDebtId: "revi" })).toEqual({
      savingsDelta: 100, debtOps: [{ debtId: "revi", delta: 100 }],
    });
  });

  it("card → none reverses the debt only", () => {
    const old = EXP({ paidWithDebtId: "revi", amount: 100 });
    expect(expenseDeltas(old, { paidWithDebtId: null })).toEqual({
      savingsDelta: 0, debtOps: [{ debtId: "revi", delta: -100 }],
    });
  });

  it("none → card charges the new debt only", () => {
    const old = EXP({ amount: 100 });
    expect(expenseDeltas(old, { paidWithDebtId: "revi" })).toEqual({
      savingsDelta: 0, debtOps: [{ debtId: "revi", delta: 100 }],
    });
  });

  it("a no-op patch produces zero deltas", () => {
    const old = EXP({ amount: 100 });
    expect(expenseDeltas(old, {})).toEqual({ savingsDelta: 0, debtOps: [] });
    expect(expenseDeltas(old, { amount: 100 })).toEqual({ savingsDelta: 0, debtOps: [] });

    const cardOld = EXP({ paidWithDebtId: "revi", amount: 100 });
    expect(expenseDeltas(cardOld, {})).toEqual({ savingsDelta: 0, debtOps: [] });
    expect(expenseDeltas(cardOld, { amount: 100 })).toEqual({ savingsDelta: 0, debtOps: [] });
  });
});
