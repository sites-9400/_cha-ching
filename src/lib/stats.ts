export interface CurvePoint { month: string; balance: number }

/**
 * Reconstruct end-of-month tracked-debt balance from the live total + payment
 * history: balance at end of month m = currentTotal + Σ(payments in months > m).
 * `payments` must already be filtered to tracked (non-BNPL) debts. Pure.
 */
export function debtCurve(
  currentTotal: number,
  payments: readonly { monthKey: string; amount: number }[],
): CurvePoint[] {
  const paidByMonth = new Map<string, number>();
  for (const p of payments) {
    paidByMonth.set(p.monthKey, (paidByMonth.get(p.monthKey) ?? 0) + p.amount);
  }
  const months = [...paidByMonth.keys()].sort();
  let laterSum = 0;
  const out: CurvePoint[] = [];
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    out.unshift({ month: m, balance: currentTotal + laterSum });
    laterSum += paidByMonth.get(m) ?? 0;
  }
  return out;
}

export interface CategoryTotal { category: string; total: number }

/** This month's expenses summed per category, sorted total descending. Pure. */
export function categoryTotals(
  expenses: readonly { amount: number; category: string; date: string }[],
  monthKey: string,
): CategoryTotal[] {
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    if (e.date.slice(0, 7) !== monthKey) continue;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }
  return [...byCat.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** This month's expenses summed per day-of-month. Pure. */
export function dailyTotals(
  expenses: readonly { amount: number; date: string }[],
  monthKey: string,
): Map<number, number> {
  const byDay = new Map<number, number>();
  for (const e of expenses) {
    if (e.date.slice(0, 7) !== monthKey) continue;
    const day = Number(e.date.slice(8, 10));
    byDay.set(day, (byDay.get(day) ?? 0) + e.amount);
  }
  return byDay;
}

/**
 * The next release month (1–12) on or after `fromMonthIndex`, wrapping to the
 * earliest if none remain; null if the fund never releases. Pure.
 */
export function nextRelease(releaseMonths: readonly number[], fromMonthIndex: number): number | null {
  if (releaseMonths.length === 0) return null;
  const sorted = [...releaseMonths].sort((a, b) => a - b);
  return sorted.find((m) => m >= fromMonthIndex) ?? sorted[0];
}
