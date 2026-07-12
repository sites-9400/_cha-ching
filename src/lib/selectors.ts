import { addMonths } from "./format";
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

/** Rollover: template copy (status blank) + this month's events as one-off lines (cutoff 2). */
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
      cutoff: 2,
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
