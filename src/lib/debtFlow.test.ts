import { describe, expect, it } from "vitest";
import { monthlyDebtFlow } from "./debtFlow";

const base = { expenses: [], statementCharges: [], debts: [], payments: [] };

describe("monthlyDebtFlow", () => {
  it("sums card expenses and statement charges, credits reduce, ignores non-card expenses", () => {
    const [m] = monthlyDebtFlow({
      ...base,
      expenses: [
        { amount: 100.1, date: "2026-08-03", paidWithDebtId: "c1" },
        { amount: 50, date: "2026-08-04" }, // not on a card
        { amount: 70, date: "2026-07-31", paidWithDebtId: "c1" }, // other month
      ],
      statementCharges: [
        { amount: 200.2, monthKey: "2026-08" },
        { amount: -30, monthKey: "2026-08" }, // refund
        { amount: 999, monthKey: "2026-09" },
      ],
      months: ["2026-08"],
    });
    expect(m.cardCharges).toBe(270.3);
    expect(m.added).toBe(270.3);
  });

  it("counts opened debts using openedAmount, falling back to startingBalance", () => {
    const [m] = monthlyDebtFlow({
      ...base,
      debts: [
        { name: "Laptop", startingBalance: 5000, openedMonth: "2026-08", openedAmount: 4000 },
        { name: "Loan", startingBalance: 1000.5, openedMonth: "2026-08" },
        { name: "Old", startingBalance: 777, openedMonth: "2026-07" },
        { name: "Legacy", startingBalance: 123 },
      ],
      months: ["2026-08"],
    });
    expect(m.newDebts).toBe(5000.5);
    expect(m.newDebtItems).toEqual([
      { name: "Laptop", amount: 4000 },
      { name: "Loan", amount: 1000.5 },
    ]);
  });

  it("buckets payments by date month", () => {
    const out = monthlyDebtFlow({
      ...base,
      payments: [
        { amount: 100, date: "2026-07-31T10:00:00" },
        { amount: 0.1, date: "2026-08-01" },
        { amount: 0.2, date: "2026-08-15" },
      ],
      months: ["2026-07", "2026-08"],
    });
    expect(out.map((m) => m.paid)).toEqual([100, 0.3]);
  });

  it("net is positive when debt grew and negative when it shrank", () => {
    const [grew, shrank] = monthlyDebtFlow({
      ...base,
      expenses: [{ amount: 500, date: "2026-08-02", paidWithDebtId: "c1" }],
      payments: [{ amount: 200, date: "2026-08-10" }, { amount: 900, date: "2026-09-10" }],
      months: ["2026-08", "2026-09"],
    });
    expect(grew.net).toBe(300);
    expect(shrank.net).toBe(-900);
  });
});
