import { useState } from "react";
import { useAccounts } from "./AccountsProvider";
import { peso } from "../lib/format";
import { logDebtPayment } from "../lib/repo";
import { allocateCutoff } from "../lib/allocate";
import { paidByDebt } from "../lib/funding";
import type { Debt } from "../lib/types";
import ConfirmPayDialog from "./ConfirmPayDialog";

export interface PaymentRec {
  id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2; date: string;
}

const KIND_LABEL: Record<string, string> = { target: "target", spill: "spill", minimum: "min" };

export default function DebtPlan({
  freeCash, debts, payments, monthKey, cutoff, unplanned = 0, readOnly = false, cycleMins,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; monthKey: string; cutoff: 1 | 2;
  unplanned?: number; readOnly?: boolean; cycleMins?: ReadonlyMap<string, number>;
}) {
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const { chip, label } = useAccounts();

  // What's already been paid this cutoff is FIXED to the debt (by id) — immune to
  // reordering. Only the REMAINING free cash is allocated live for what's still to pay.
  const paid = paidByDebt(payments, monthKey, cutoff);
  const paidTotal = [...paid.values()].reduce((s, n) => s + n, 0);
  const remaining = Math.max(0, freeCash - paidTotal);
  const alloc = allocateCutoff(remaining, debts, cutoff, cycleMins);

  const paidLines = [...paid.entries()]
    .map(([debtId, amount]) => ({ debt: debts.find((d) => d.id === debtId), amount }))
    .filter((x): x is { debt: Debt; amount: number } => !!x.debt)
    .sort((a, b) => a.debt.payoffOrder - b.debt.payoffOrder);

  if (paidLines.length === 0 && alloc.lines.length === 0 && alloc.shortfall === 0) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <p className="text-xs font-semibold text-stone-500 mb-2">
        DEBT PLAN · free cash {peso(freeCash)}
        {unplanned > 0 && <span className="font-normal text-stone-400"> (after {peso(unplanned)} unplanned)</span>}
        {paidTotal > 0 && <span className="font-normal text-emerald-600"> · {peso(remaining)} left</span>}
      </p>
      <ul className="flex flex-col gap-1.5">
        {/* Already paid this cutoff — fixed, ticked, not re-derived. */}
        {paidLines.map(({ debt, amount }) => (
          <li key={`paid-${debt.id}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-emerald-600">✓</span>
              <span className="truncate line-through text-stone-400">{debt.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${chip(debt.channel)}`}>{label(debt.channel)}</span>
              <span className="text-[10px] text-emerald-600">paid</span>
            </span>
            <span className="font-bold tabular-nums text-stone-400 shrink-0">{peso(amount)}</span>
          </li>
        ))}
        {/* Still to send — the remaining free cash, allocated live. */}
        {alloc.lines.map((l) => (
          <li key={l.debtId} className="flex items-center justify-between gap-2 text-sm">
            <button
              disabled={readOnly}
              onClick={readOnly ? undefined : () => setPayDebt(debts.find((d) => d.id === l.debtId) ?? null)}
              className="flex items-center gap-2 min-w-0"
            >
              <span className="text-stone-300">✓</span>
              <span className="truncate font-medium">{l.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${chip(l.channel)}`}>{label(l.channel)}</span>
              <span className="text-[10px] text-stone-400">{KIND_LABEL[l.kind]}</span>
            </button>
            <span className="text-right shrink-0">
              <span className="font-bold tabular-nums">{peso(l.amount)}</span>
              {l.minIncluded != null && (
                <span className="block text-[10px] text-stone-400">incl. {peso(l.minIncluded)} min</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {alloc.shortfall > 0 && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          Short {peso(alloc.shortfall)} for minimums this cutoff.
        </p>
      )}
      {payDebt && (
        <ConfirmPayDialog
          debtName={payDebt.name}
          currentBalance={payDebt.currentBalance}
          defaultAmount={alloc.lines.find((l) => l.debtId === payDebt.id)?.amount ?? payDebt.currentBalance}
          onConfirm={async (amt) => {
            await logDebtPayment(payDebt.id, amt, monthKey, cutoff);
            setPayDebt(null);
          }}
          onCancel={() => setPayDebt(null)}
        />
      )}
    </div>
  );
}
