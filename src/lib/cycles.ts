import { addMonths } from "./format";

/** "YYYY-MM-DD" for a nominal day-of-month in `monthKey`, clamped to the month's length. */
function dateInMonth(monthKey: string, day: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${monthKey}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Cycle key ("YYYY-MM" of the statement) current on `today`: the most recent statement ≤ today. */
export function currentCycleKey(statementDay: number, today: Date): string {
  const monthKey = monthKeyOf(today);
  const todayIso = `${monthKey}-${String(today.getDate()).padStart(2, "0")}`;
  return todayIso >= dateInMonth(monthKey, statementDay) ? monthKey : addMonths(monthKey, -1);
}

/** Statement + due dates for a cycle. Due = next dueDay occurrence strictly after the statement. */
export function cycleDates(
  statementDay: number, dueDay: number, cycleKey: string,
): { statementDate: string; dueDate: string } {
  const statementDate = dateInMonth(cycleKey, statementDay);
  const sameMonthDue = dateInMonth(cycleKey, dueDay);
  const dueDate = sameMonthDue > statementDate ? sameMonthDue : dateInMonth(addMonths(cycleKey, 1), dueDay);
  return { statementDate, dueDate };
}

/** Payments for one debt dated within [statement, next statement). Pure. */
export function paidInCycle(
  payments: readonly { debtId: string; date: string; amount: number }[],
  debtId: string,
  statementDay: number,
  cycleKey: string,
): number {
  const start = dateInMonth(cycleKey, statementDay);
  const end = dateInMonth(addMonths(cycleKey, 1), statementDay);
  return payments
    .filter((p) => p.debtId === debtId && p.date.slice(0, 10) >= start && p.date.slice(0, 10) < end)
    .reduce((s, p) => s + p.amount, 0);
}

/** Whole days from `today` to `dateIso` (negative when past), ignoring time of day. */
export function daysUntil(dateIso: string, today: Date): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const a = new Date(y, m - 1, d).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * Per-debt reserve for the allocation's minimums pass: the current cycle's
 * minimum (entered statement doc, else the static `minimum`) net of payments
 * already inside the billing window — so paying a card after its statement
 * date ticks its minimum down even before a statement is entered. Debts
 * without a statementDay have no billing window and get no entry — callers
 * fall back to the un-netted static `minimum`. Pass `payments: []` for the
 * gross variant used by full-cutoff views.
 */
export function cycleMinimums(
  debts: readonly { id: string; statementDay?: number; minimum?: number }[],
  cycles: readonly { id: string; debtId?: string; minimumDue: number }[],
  payments: readonly { debtId: string; date: string; amount: number }[],
  today: Date,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of debts) {
    if (!d.statementDay) continue;
    const key = currentCycleKey(d.statementDay, today);
    const cyc = cycles.find((c) => c.debtId === d.id && c.id === key);
    const minDue = cyc?.minimumDue ?? d.minimum;
    if (minDue == null) continue;
    m.set(d.id, Math.max(0, minDue - paidInCycle(payments, d.id, d.statementDay, key)));
  }
  return m;
}
