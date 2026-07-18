import { addMonths } from "./format";
import { cutoffForDueDay } from "./allocate";
import type { Debt, EventItem, Income, MonthLine, SinkingFund, TemplateLine } from "./types";

export interface CutoffSummary {
  income: number;
  planned: number;
  ticked: number;
  surplus: number;
}

export function cutoffSummary(
  lines: MonthLine[],
  incomes: Income[],
  cutoff: 1 | 2,
): CutoffSummary {
  const inCut = <T extends { cutoff: 1 | 2 }>(xs: T[]): T[] => xs.filter((x) => x.cutoff === cutoff);
  const income = inCut(incomes).reduce((s, i) => s + i.amount, 0);
  const cutLines = inCut(lines);
  const planned = cutLines.reduce((s, l) => s + l.amount, 0);
  const ticked = cutLines.filter((l) => l.status !== "").reduce((s, l) => s + l.amount, 0);
  return { income, planned, ticked, surplus: income - planned };
}

/** A started cutoff is closed when it has lines and every one is ticked. Derived, never stored. */
export function isCutoffClosed(lines: readonly MonthLine[], cutoff: 1 | 2): boolean {
  const cut = lines.filter((l) => l.cutoff === cutoff);
  return cut.length > 0 && cut.every((l) => l.status !== "");
}

/** Sum of this month's Quick Add expenses drawn from envelope line `lineId`. */
export function envelopeSpent(
  expenses: readonly { amount: number; date: string; envelopeLineId?: string }[],
  monthKey: string,
  lineId: string,
): number {
  return expenses
    .filter((e) => e.envelopeLineId === lineId && e.date.slice(0, 7) === monthKey)
    .reduce((s, e) => s + e.amount, 0);
}

/**
 * Unplanned spending charged to `cutoff`:
 *  - envelope-less expenses, attributed by the date's day (13–24 → 1, else 2),
 *    rolled to the other cutoff when the attributed one is closed, and to
 *    nowhere (tracking-only) when both are closed;
 *  - each envelope line's overspend excess (spent − amount, min 0) in its own
 *    cutoff. Expenses whose envelopeLineId no longer matches an envelope line
 *    count as envelope-less. Reduces the debt plan's free cash so it never
 *    allocates cash that was already spent.
 */
export function unplannedForCutoff(
  expenses: readonly { amount: number; date: string; envelopeLineId?: string }[],
  monthKey: string,
  cutoff: 1 | 2,
  lines: readonly MonthLine[],
): number {
  const closed = { 1: isCutoffClosed(lines, 1), 2: isCutoffClosed(lines, 2) };
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const attribute = (day: number): 1 | 2 | null => {
    const first = cutoffForDueDay(day);
    if (!closed[first]) return first;
    const other = first === 1 ? 2 : 1;
    return closed[other] ? null : other;
  };

  let total = 0;
  for (const e of expenses) {
    if (e.date.slice(0, 7) !== monthKey) continue;
    const envLine = e.envelopeLineId ? lineById.get(e.envelopeLineId) : undefined;
    if (envLine?.isEnvelope) continue; // drawn from the envelope, counted below as excess only
    if (attribute(Number(e.date.slice(8, 10))) === cutoff) total += e.amount;
  }
  for (const l of lines) {
    if (!l.isEnvelope || l.cutoff !== cutoff) continue;
    total += Math.max(0, envelopeSpent(expenses, monthKey, l.id) - l.amount);
  }
  return total;
}

export interface DebtTotals {
  total: number;
  blitz: number; // interest-bearing (non-BNPL) debt only
}

export function debtTotals(debts: Debt[]): DebtTotals {
  const active = debts.filter((d) => d.active);
  const total = active.reduce((s, d) => s + d.currentBalance, 0);
  const blitz = active.filter((d) => !d.isBNPL).reduce((s, d) => s + d.currentBalance, 0);
  return { total, blitz };
}

/** Naive projection: blitz debt / monthly paydown, ceilinged, from given month. */
export function projectDebtFreeMonth(
  debts: Debt[],
  monthlyPaydown: number,
  fromMonth: string,
): string {
  const { blitz } = debtTotals(debts);
  if (blitz <= 0 || monthlyPaydown <= 0) return fromMonth;
  return addMonths(fromMonth, Math.ceil(blitz / monthlyPaydown) - 1);
}

/** Rollover: template copy (status blank) + this month's events as one-off lines (per event's cutoff, default 2). */
export function generateMonthLines(
  template: TemplateLine[],
  events: EventItem[],
  monthKey: string,
): MonthLine[] {
  const base: MonthLine[] = template.map((t) => ({ ...t, status: "", oneOff: false }));
  const oneOffs: MonthLine[] = events
    .filter((e) => e.month === monthKey)
    .map((e, i) => ({
      id: `event-${e.id}`,
      name: e.name,
      amount: e.amount,
      channel: e.channel ?? "CASH",
      cutoff: e.cutoff ?? 2,
      order: 1000 + i,
      status: "",
      oneOff: true,
    }));
  return [...base, ...oneOffs];
}

export interface FundState {
  deposit: number;
  release: number;
  balanceAfter: number;
}

/** What the fund does in calendar month `monthIndex` (1-12): deposit always, release all after deposit on release months. */
export function fundStateFor(fund: SinkingFund, monthIndex: number): FundState {
  const deposit = fund.monthlyDeposit;
  const afterDeposit = fund.balance + deposit;
  const isRelease = fund.releaseMonths.includes(monthIndex);
  const release = isRelease ? afterDeposit : 0;
  return { deposit, release, balanceAfter: afterDeposit - release };
}
