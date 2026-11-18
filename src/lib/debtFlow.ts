import type { Debt, Expense, StatementCharge } from "./types";

export interface DebtFlowPayment { amount: number; date?: string; monthKey?: string }

export interface DebtFlowMonth {
  monthKey: string;
  cardCharges: number;
  newDebts: number;
  added: number;
  paid: number;
  net: number;
  newDebtItems: { name: string; amount: number }[];
}

const cents = (n: number): number => Math.round(n * 100);
const peso2 = (c: number): number => c / 100;

/** Per-month debt flow: new debt added (card charges + newly opened loans) vs paid off.
 *  Sums in integer centavos to avoid float drift. Read-only: touches no balances. */
export function monthlyDebtFlow({ expenses, statementCharges, debts, payments, months }: {
  expenses: Pick<Expense, "amount" | "date" | "paidWithDebtId">[];
  statementCharges: Pick<StatementCharge, "amount" | "monthKey">[];
  debts: Pick<Debt, "name" | "startingBalance" | "openedMonth" | "openedAmount">[];
  payments: DebtFlowPayment[];
  months: string[];
}): DebtFlowMonth[] {
  return months.map((monthKey) => {
    let card = 0;
    for (const e of expenses) {
      if (e.paidWithDebtId && (e.date ?? "").slice(0, 7) === monthKey) card += cents(e.amount);
    }
    for (const c of statementCharges) {
      if (c.monthKey === monthKey) card += cents(c.amount);
    }
    let opened = 0;
    const newDebtItems: { name: string; amount: number }[] = [];
    for (const d of debts) {
      if (d.openedMonth === monthKey) {
        const amount = d.openedAmount ?? d.startingBalance;
        opened += cents(amount);
        newDebtItems.push({ name: d.name, amount: peso2(cents(amount)) });
      }
    }
    let paid = 0;
    for (const p of payments) {
      const m = p.date ? p.date.slice(0, 7) : p.monthKey;
      if (m === monthKey) paid += cents(p.amount);
    }
    const added = card + opened;
    return {
      monthKey,
      cardCharges: peso2(card),
      newDebts: peso2(opened),
      added: peso2(added),
      paid: peso2(paid),
      net: peso2(added - paid),
      newDebtItems,
    };
  });
}
