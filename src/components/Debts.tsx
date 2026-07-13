import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { channelChipSafe } from "../lib/channels";
import { currentMonthKey, monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { debtsCol } from "../lib/paths";
import { logDebtPayment, setDebtMinimum, undoDebtPayment } from "../lib/repo";
import { debtTotals, projectDebtFreeMonth } from "../lib/selectors";
import { cutoffForDueDay } from "../lib/allocate";
import type { Debt } from "../lib/types";
import ConfirmPayDialog from "./ConfirmPayDialog";
import type { PaymentRec } from "./DebtPlan";

const MONTHLY_PAYDOWN = 90164; // plan's free cash/month; projection basis until history exists

export default function Debts() {
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const thisMonth = currentMonthKey();
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [minEditId, setMinEditId] = useState<string | null>(null);
  const [minValue, setMinValue] = useState("");

  async function saveMin(id: string) {
    const v = Number(minValue);
    if (v >= 0) await setDebtMinimum(id, v);
    setMinEditId(null);
    setMinValue("");
  }

  const active = [...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
  const totals = debtTotals(debts);
  const freeMonth = projectDebtFreeMonth(debts, MONTHLY_PAYDOWN, currentMonthKey());

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-1">Debts</h1>
      <p className="text-sm text-stone-500 mb-4">
        {peso(totals.total)} left · interest-bearing clear by{" "}
        <span className="font-semibold text-stone-700">{monthLabel(freeMonth)}</span>
      </p>
      <ul className="flex flex-col gap-3">
        {active.map((d) => {
          const paid = d.startingBalance - d.currentBalance;
          const pct = d.startingBalance > 0 ? Math.round((paid / d.startingBalance) * 100) : 0;
          return (
            <li key={d.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm flex items-center gap-2">
                  {d.name}
                  {d.isBNPL && <span className="text-[10px] text-emerald-600">0% BNPL</span>}
                </span>
                <span className="text-sm font-bold tabular-nums">{peso(d.currentBalance)}</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 my-2 overflow-hidden">
                <div className={`h-full ${d.isBNPL ? "bg-emerald-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                {minEditId === d.id ? (
                  <span className="flex items-center gap-1">
                    <span>Min ₱</span>
                    <input
                      type="number" inputMode="decimal" autoFocus
                      value={minValue} onChange={(e) => setMinValue(e.target.value)}
                      className="w-20 border-b border-stone-300 outline-none tabular-nums"
                    />
                    <button onClick={() => void saveMin(d.id)} className="font-semibold text-emerald-700 px-1">Save</button>
                    <button onClick={() => { setMinEditId(null); setMinValue(""); }} className="text-stone-400">✕</button>
                  </span>
                ) : d.minimum != null ? (
                  <button onClick={() => { setMinEditId(d.id); setMinValue(String(d.minimum)); }}>
                    Min {peso(d.minimum)} · edit
                  </button>
                ) : (
                  <button
                    onClick={() => { setMinEditId(d.id); setMinValue(""); }}
                    className="text-amber-600 font-medium"
                  >
                    Set minimum
                  </button>
                )}
              </div>
              {payments
                .filter((p) => p.debtId === d.id && p.monthKey === thisMonth)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Paid {peso(p.amount)} · cutoff {p.cutoff}</span>
                    <button
                      onClick={() => void undoDebtPayment(d.id, p.id, p.amount)}
                      className="text-red-500 font-medium"
                    >
                      Undo
                    </button>
                  </div>
                ))}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${channelChipSafe(d.channel)}`}>
                  {d.channel}
                </span>
                <button onClick={() => setPayDebt(d)} className="text-xs font-semibold text-emerald-700">
                  Log payment
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {payDebt && (
        <ConfirmPayDialog
          debtName={payDebt.name}
          currentBalance={payDebt.currentBalance}
          defaultAmount={payDebt.currentBalance}
          onConfirm={async (amt) => {
            await logDebtPayment(payDebt.id, amt, currentMonthKey(), cutoffForDueDay(payDebt.dueDay));
            setPayDebt(null);
          }}
          onCancel={() => setPayDebt(null)}
        />
      )}
    </main>
  );
}
