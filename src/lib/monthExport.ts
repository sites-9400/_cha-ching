import type { Column } from "./export";
import { lineComparators } from "./lineSort";
import type { Debt, MonthLine } from "./types";

/** The payment fields this module needs. Structurally satisfied by `PaymentRec`
 *  (src/components/DebtPlan.tsx) — kept local so lib code never imports a component. */
export interface ExportPayment {
  debtId: string;
  amount: number;
  monthKey: string;
  cutoff: 1 | 2;
  /** Present when the payment came from ticking a month line PAID (`toggleLinePaid`). */
  lineId?: string;
}

export interface MonthExportRow {
  cutoff: number;
  name: string;
  amount: number;
  channel: string;
  status: string;
  type: "recurring" | "one-off" | "debt-payment";
  paysDebt: string;
}

export const MONTH_EXPORT_COLUMNS: Column<MonthExportRow>[] = [
  { key: "cutoff", label: "Cutoff" },
  { key: "name", label: "Name" },
  { key: "amount", label: "Amount" },
  { key: "channel", label: "Channel" },
  { key: "status", label: "Status" },
  { key: "type", label: "Type" },
  { key: "paysDebt", label: "Pays debt" },
];

/** Flatten a month into CSV rows: every line, plus the debt payments logged that
 *  month from the Debt Plan screen. Payments carrying a `lineId` are skipped —
 *  their line is already a row, so including them would double-count. Pure. */
export function monthExportRows(
  lines: readonly MonthLine[],
  payments: readonly ExportPayment[],
  debts: readonly Debt[],
  monthKey: string,
): MonthExportRow[] {
  const byId = new Map(debts.map((d) => [d.id, d]));

  const lineRows: MonthExportRow[] = [...lines]
    .sort((a, b) => (a.cutoff - b.cutoff) || lineComparators.order(a, b))
    .map((l) => ({
      cutoff: l.cutoff,
      name: l.name,
      amount: l.amount,
      channel: String(l.channel),
      status: l.status,
      type: l.oneOff ? "one-off" : "recurring",
      paysDebt: (l.debtId ? byId.get(l.debtId)?.name : undefined) ?? "",
    }));

  const paymentRows: MonthExportRow[] = payments
    .filter((p) => p.monthKey === monthKey && !p.lineId)
    .map((p) => {
      const debt = byId.get(p.debtId);
      return {
        cutoff: p.cutoff,
        name: "Extra payment",
        amount: p.amount,
        channel: debt ? String(debt.channel) : "",
        status: "PAID",
        type: "debt-payment" as const,
        paysDebt: debt?.name ?? "Unknown debt",
      };
    });

  // Array.prototype.sort is stable, so equal cutoffs keep lines ahead of payments.
  return [...lineRows, ...paymentRows].sort((a, b) => a.cutoff - b.cutoff);
}
