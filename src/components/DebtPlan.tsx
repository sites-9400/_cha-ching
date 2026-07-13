import { useState } from "react";
import { channelChipSafe } from "../lib/channels";
import { peso } from "../lib/format";
import { logDebtPayment } from "../lib/repo";
import { allocateCutoff } from "../lib/allocate";
import type { Debt } from "../lib/types";
import ConfirmPayDialog from "./ConfirmPayDialog";

export interface PaymentRec {
  id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2;
}

const KIND_LABEL: Record<string, string> = { target: "target", spill: "spill", minimum: "min" };

export default function DebtPlan({
  freeCash, debts, payments, monthKey, cutoff,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; monthKey: string; cutoff: 1 | 2;
}) {
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const alloc = allocateCutoff(freeCash, debts, cutoff);

  const isPaid = (debtId: string) =>
    payments.some((p) => p.debtId === debtId && p.monthKey === monthKey && p.cutoff === cutoff);

  if (alloc.lines.length === 0 && alloc.shortfall === 0) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <p className="text-xs font-semibold text-stone-500 mb-2">DEBT PLAN · free cash {peso(freeCash)}</p>
      <ul className="flex flex-col gap-1.5">
        {alloc.lines.map((l) => {
          const paid = isPaid(l.debtId);
          return (
            <li key={l.debtId} className="flex items-center justify-between gap-2 text-sm">
              <button
                disabled={paid}
                onClick={() => setPayDebt(debts.find((d) => d.id === l.debtId) ?? null)}
                className="flex items-center gap-2 min-w-0"
              >
                <span className={paid ? "text-emerald-600" : "text-stone-300"}>✓</span>
                <span className={`truncate ${paid ? "line-through text-stone-400" : "font-medium"}`}>{l.name}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${channelChipSafe(l.channel)}`}>
                  {l.channel}
                </span>
                <span className="text-[10px] text-stone-400">{KIND_LABEL[l.kind]}</span>
              </button>
              <span className="text-right shrink-0">
                <span className="font-bold tabular-nums">{peso(l.amount)}</span>
                {l.minIncluded != null && (
                  <span className="block text-[10px] text-stone-400">incl. {peso(l.minIncluded)} min</span>
                )}
              </span>
            </li>
          );
        })}
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
