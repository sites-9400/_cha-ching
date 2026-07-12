import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { channelChipSafe } from "../lib/channels";
import { currentMonthKey, monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { debtsCol } from "../lib/paths";
import { logDebtPayment } from "../lib/repo";
import { debtTotals, projectDebtFreeMonth } from "../lib/selectors";
import type { Debt } from "../lib/types";

const MONTHLY_PAYDOWN = 90164; // plan's free cash/month; projection basis until history exists

export default function Debts() {
  const debts = useCollection<Debt>(debtsCol());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const active = [...debts].filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
  const totals = debtTotals(debts);
  const freeMonth = projectDebtFreeMonth(debts, MONTHLY_PAYDOWN, currentMonthKey());

  async function pay(id: string) {
    const v = Number(amount);
    if (v > 0) await logDebtPayment(id, v, currentMonthKey());
    setPayingId(null);
    setAmount("");
  }

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
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${channelChipSafe(d.channel)}`}>
                  {d.channel}
                </span>
                {payingId === d.id ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number" inputMode="decimal" placeholder="Amount" autoFocus
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-24 text-sm border-b border-stone-300 outline-none tabular-nums"
                    />
                    <button onClick={() => void pay(d.id)} className="text-xs font-semibold text-emerald-700 px-2">Log</button>
                    <button onClick={() => { setPayingId(null); setAmount(""); }} className="text-xs text-stone-400">✕</button>
                  </span>
                ) : (
                  <button onClick={() => setPayingId(d.id)} className="text-xs font-semibold text-emerald-700">
                    Log payment
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
