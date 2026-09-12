import type { DebtSplit, MonthLine } from "./types";

type SplitLine = Pick<MonthLine, "amount" | "debtId" | "debtSplits">;

/** Discard rows that carry no real payment: a blank debtId or a non-positive amount. */
function validSplits(splits: DebtSplit[]): DebtSplit[] {
  return splits.filter((s) => s.debtId !== "" && s.amount > 0);
}

/**
 * The debt payments a line's ticking should log. `debtSplits` takes precedence
 * over `debtId` when it has at least one entry after filtering out blank/zero
 * rows; otherwise a single `debtId` becomes one payment for the full amount;
 * with neither, the line pays no debt at all. Pure: never mutates the input.
 */
export function paymentsForLine(line: SplitLine): DebtSplit[] {
  const splits = line.debtSplits ? validSplits(line.debtSplits) : [];
  if (splits.length > 0) return splits.map((s) => ({ ...s }));
  if (line.debtId) return [{ debtId: line.debtId, amount: line.amount }];
  return [];
}

/** How much of `amount` is still unassigned across `splits`, rounded to 2dp. */
export function splitsRemainder(amount: number, splits: DebtSplit[]): number {
  const allocated = splits.reduce((s, x) => s + x.amount, 0);
  return Math.round((amount - allocated) * 100) / 100;
}

/** Distinct debt ids a line pays, via splits or the single debtId fallback. */
export function linkedDebtIds(line: SplitLine): string[] {
  return [...new Set(paymentsForLine(line).map((p) => p.debtId))];
}
