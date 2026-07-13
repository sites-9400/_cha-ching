import { addMonths } from "./format";
import { allocateCutoff, type Allocation } from "./allocate";
import { cutoffSummary, generateMonthLines } from "./selectors";
import type { Debt, EventItem, Income, TemplateLine } from "./types";

/** Subtract each allocation line's amount from its debt's balance (floored at 0). Pure. */
export function applyAllocation(debts: Debt[], alloc: Allocation): Debt[] {
  const paid = new Map<string, number>();
  for (const l of alloc.lines) paid.set(l.debtId, (paid.get(l.debtId) ?? 0) + l.amount);
  return debts.map((d) =>
    paid.has(d.id) ? { ...d, currentBalance: Math.max(0, d.currentBalance - paid.get(d.id)!) } : d,
  );
}

/** Fold whole months forward: each step runs cutoff 1 then cutoff 2 down the avalanche. Pure. */
export function simulateBalances(debts: Debt[], steps: { c1: number; c2: number }[]): Debt[] {
  let bal = debts;
  for (const step of steps) {
    bal = applyAllocation(bal, allocateCutoff(step.c1, bal, 1));
    bal = applyAllocation(bal, allocateCutoff(step.c2, bal, 2));
  }
  return bal;
}

/**
 * Project a future month's debt plan: simulate every whole month strictly between
 * `currentKey` and `viewedKey`, then compute the viewed month's two cutoff
 * allocations on the simulated balances. Pure.
 */
export function projectMonthPlan(
  viewedKey: string,
  currentKey: string,
  debts: Debt[],
  template: TemplateLine[],
  events: EventItem[],
  incomes: Income[],
): { free: { c1: number; c2: number }; alloc: { c1: Allocation; c2: Allocation } } {
  const freeFor = (mk: string) => {
    const ln = generateMonthLines(template, events, mk);
    return {
      c1: Math.max(0, cutoffSummary(ln, incomes, 1).surplus),
      c2: Math.max(0, cutoffSummary(ln, incomes, 2).surplus),
    };
  };
  const between: string[] = [];
  for (let m = addMonths(currentKey, 1); m < viewedKey; m = addMonths(m, 1)) between.push(m);
  const simDebts = simulateBalances(debts, between.map(freeFor));

  const free = freeFor(viewedKey);
  const c1 = allocateCutoff(free.c1, simDebts, 1);
  const afterC1 = applyAllocation(simDebts, c1);
  const c2 = allocateCutoff(free.c2, afterC1, 2);
  return { free, alloc: { c1, c2 } };
}
