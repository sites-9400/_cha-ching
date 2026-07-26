import type { SavingsMove } from "./types";

export interface SavingsEntry {
  id: string;
  date: string;
  amount: number;            // always positive
  direction: "in" | "out";
  source: string;
  kind: "move" | "expense";  // expense rows are read-only in the UI
}

interface SavingsExpense {
  id: string;
  amount: number;
  date: string;
  note?: string;
  category?: string;
  fundedBySavings?: boolean;
}

/** The savings ledger: deliberate moves merged with the expenses already funded
 *  from savings, newest first. Expenses are read, never written, so the delta
 *  handling in `updateExpense` stays the single source of truth for them. Pure. */
export function savingsHistory(
  moves: readonly SavingsMove[],
  expenses: readonly SavingsExpense[],
  limit = 8,
): SavingsEntry[] {
  const fromMoves: SavingsEntry[] = moves.map((m) => ({
    id: m.id, date: m.date, amount: m.amount, direction: m.direction,
    source: m.source, kind: "move",
  }));

  const fromExpenses: SavingsEntry[] = expenses
    .filter((e) => e.fundedBySavings)
    .map((e) => ({
      id: e.id, date: e.date, amount: e.amount, direction: "out",
      source: e.note?.trim() || e.category?.trim() || "Expense",
      kind: "expense",
    }));

  return [...fromMoves, ...fromExpenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
