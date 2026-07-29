import type { ExpenseInput } from "./types";

export interface ExpenseDeltas {
  savingsDelta: number; // increment for meta.savingsBalance (positive → give back)
  debtOps: { debtId: string; delta: number }[]; // increments for debts/{id}.currentBalance
}

/** Bookkeeping deltas implied by patching an expense. Pure. */
export function expenseDeltas(
  old: ExpenseInput,
  patch: { amount?: number; fundedBySavings?: boolean | null; paidWithDebtId?: string | null },
): ExpenseDeltas {
  const wasFunded = !!old.fundedBySavings;
  const nowFunded = patch.fundedBySavings === undefined ? wasFunded : patch.fundedBySavings === true;
  const newAmount = patch.amount ?? old.amount;
  const savingsDelta = (wasFunded ? old.amount : 0) - (nowFunded ? newAmount : 0);

  const oldDebtId = old.paidWithDebtId;
  const newDebtId = patch.paidWithDebtId === undefined ? oldDebtId : (patch.paidWithDebtId ?? undefined);
  const debtOps: { debtId: string; delta: number }[] = [];
  if (oldDebtId === newDebtId) {
    if (oldDebtId && newAmount !== old.amount) debtOps.push({ debtId: oldDebtId, delta: newAmount - old.amount });
  } else {
    if (oldDebtId) debtOps.push({ debtId: oldDebtId, delta: -old.amount });
    if (newDebtId) debtOps.push({ debtId: newDebtId, delta: newAmount });
  }
  return { savingsDelta, debtOps };
}
