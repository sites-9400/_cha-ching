import { describe, expect, it } from "vitest";
import { installmentProgress } from "./selectors";
import type { Debt } from "./types";

const debt = (over: Partial<Debt>): Debt => ({
  id: "d", name: "d", startingBalance: 0, currentBalance: 0, payoffOrder: 1,
  channel: "MARIBANK", isBNPL: true, active: true, ...over,
});

describe("installmentProgress", () => {
  it("counts paid installments from the balance left (laptop 1 of 12)", () => {
    expect(installmentProgress(debt({ currentBalance: 47666, installments: 12, amortization: 4332.92 }))).toEqual({ paid: 1, total: 12 });
  });
  it("is 0 paid before the first payment", () => {
    expect(installmentProgress(debt({ currentBalance: 93174, installments: 6, amortization: 15529 }))).toEqual({ paid: 0, total: 6 });
  });
  it("is fully paid at a zero balance", () => {
    expect(installmentProgress(debt({ currentBalance: 0, installments: 6, amortization: 3515.67 }))).toEqual({ paid: 6, total: 6 });
  });
  it("is null without a schedule", () => {
    expect(installmentProgress(debt({ currentBalance: 500 }))).toBeNull();
  });
});
