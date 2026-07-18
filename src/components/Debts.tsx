import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { currentMonthKey, monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { debtsCol } from "../lib/paths";
import { logDebtPayment, setDebtCycle, setDebtMinimum, undoDebtPayment } from "../lib/repo";
import { debtTotals, projectDebtFreeMonth } from "../lib/selectors";
import { cutoffForDueDay } from "../lib/allocate";
import { currentCycleKey, cycleDates, daysUntil, paidInCycle } from "../lib/cycles";
import type { Debt, DebtCycle } from "../lib/types";
import ChannelIcon from "./ChannelIcon";
import ConfirmPayDialog from "./ConfirmPayDialog";
import DueSoonStrip from "./DueSoonStrip";
import StatementDialog from "./StatementDialog";
import type { PaymentRec } from "./DebtPlan";
import { useAccounts } from "./AccountsProvider";
import HeaderBand from "./HeaderBand";

const MONTHLY_PAYDOWN = 90164; // plan's free cash/month; projection basis until history exists

export default function Debts() {
  const { chip, label } = useAccounts();
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const thisMonth = currentMonthKey();
  const cycles = useCollectionGroup<DebtCycle>("cycles");
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [stmtDebt, setStmtDebt] = useState<Debt | null>(null);
  const [minEditId, setMinEditId] = useState<string | null>(null);
  const [minValue, setMinValue] = useState("");
  const today = new Date();

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
    <>
      <HeaderBand
        title="TOTAL DEBT"
        value={peso(totals.total)}
        sub={`interest-bearing clear by ${monthLabel(freeMonth)}`}
      />
      <main className="p-4">
      <DueSoonStrip />
      <ul className="flex flex-col gap-3">
        {active.map((d) => {
          const paid = d.startingBalance - d.currentBalance;
          const pct = d.startingBalance > 0 ? Math.round((paid / d.startingBalance) * 100) : 0;
          const cycleKey = d.statementDay ? currentCycleKey(d.statementDay, today) : null;
          const cycle = cycleKey ? cycles.find((c) => c.debtId === d.id && c.id === cycleKey) : undefined;
          const cycleDue = cycleKey && d.dueDay ? cycleDates(d.statementDay!, d.dueDay, cycleKey) : null;
          const cyclePaid = cycleKey ? paidInCycle(payments, d.id, d.statementDay!, cycleKey) : 0;
          const dueIn = cycleDue ? daysUntil(cycleDue.dueDate, today) : null;
          return (
            <li key={d.id} className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm flex items-center gap-2.5 min-w-0">
                  <ChannelIcon channel={String(d.channel)} initial={d.name.charAt(0).toUpperCase()} chipClass={chip(d.channel)} />
                  <span className="truncate flex items-center gap-2">
                    {d.name}
                    {d.isBNPL && <span className="text-[10px] text-emerald-600">0% BNPL</span>}
                  </span>
                </span>
                <span className="text-sm font-bold tabular-nums shrink-0">{peso(d.currentBalance)}</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 my-2 overflow-hidden">
                <div className={`h-full ${d.isBNPL ? "bg-emerald-400" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
              </div>
              {d.creditLimit != null && d.creditLimit > 0 && (
                <p className="text-[11px] text-stone-500 mb-1">
                  <span className="font-semibold text-emerald-700 tabular-nums">{peso(Math.max(0, d.creditLimit - d.currentBalance))}</span>
                  {" "}available of {peso(d.creditLimit)} limit
                </p>
              )}
              {d.statementDay != null && (
                <div className="mb-2">
                  <p className="text-[11px] text-stone-500">
                    stmt day {d.statementDay}{d.dueDay ? ` · due day ${d.dueDay}` : ""}
                    {dueIn != null && (
                      <span className={dueIn <= 3 ? "font-semibold text-red-600" : ""}>
                        {" "}· due {dueIn === 0 ? "today" : dueIn < 0 ? `${-dueIn}d ago` : `in ${dueIn}d`}
                      </span>
                    )}
                  </p>
                  {cycle ? (
                    <button onClick={() => setStmtDebt(d)} className="mt-1 w-full text-left">
                      <span className="text-[11px] text-stone-500 tabular-nums">
                        {peso(Math.min(cyclePaid, cycle.minimumDue))} of {peso(cycle.minimumDue)} min paid · stmt {peso(cycle.statementBalance)}
                      </span>
                      <span className="mt-0.5 block h-1 rounded-full bg-stone-100 overflow-hidden">
                        <span
                          className="block h-full bg-emerald-500"
                          style={{ width: `${cycle.minimumDue > 0 ? Math.min(100, Math.round((cyclePaid / cycle.minimumDue) * 100)) : 100}%` }}
                        />
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setStmtDebt(d)}
                      className="mt-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1"
                    >Enter statement</button>
                  )}
                </div>
              )}
              <div className="mb-2">
                {minEditId === d.id ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center border border-stone-300 rounded-lg px-2 py-1 text-sm">
                      <span className="text-stone-400">₱</span>
                      <input
                        type="number" inputMode="decimal" autoFocus placeholder="min"
                        value={minValue} onChange={(e) => setMinValue(e.target.value)}
                        className="w-16 outline-none tabular-nums ml-0.5"
                      />
                    </div>
                    <button
                      onClick={() => void saveMin(d.id)}
                      className="text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-1.5"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setMinEditId(null); setMinValue(""); }}
                      className="text-xs font-medium text-stone-500 bg-stone-100 rounded-lg px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                ) : d.minimum != null ? (
                  <button
                    onClick={() => { setMinEditId(d.id); setMinValue(String(d.minimum)); }}
                    className="inline-flex items-center gap-1.5 text-xs text-stone-600 bg-stone-100 rounded-full pl-3 pr-2 py-1"
                  >
                    Min {peso(d.minimum)}
                    <span className="text-emerald-700 font-semibold">Edit</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setMinEditId(d.id); setMinValue(""); }}
                    className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1"
                  >
                    + Set minimum
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
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip(d.channel)}`}>
                  {label(d.channel)}
                </span>
                <button onClick={() => setPayDebt(d)} className="text-xs font-semibold text-emerald-700">
                  Log payment
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {stmtDebt?.statementDay != null && (
        <StatementDialog
          debtName={stmtDebt.name}
          cycleKey={currentCycleKey(stmtDebt.statementDay, today)}
          defaultBalance={
            cycles.find((c) => c.debtId === stmtDebt.id && c.id === currentCycleKey(stmtDebt.statementDay!, today))?.statementBalance
            ?? stmtDebt.currentBalance
          }
          defaultMin={
            cycles.find((c) => c.debtId === stmtDebt.id && c.id === currentCycleKey(stmtDebt.statementDay!, today))?.minimumDue
            ?? stmtDebt.minimum ?? 0
          }
          onConfirm={async (bal, min) => {
            const key = currentCycleKey(stmtDebt.statementDay!, today);
            const dates = cycleDates(stmtDebt.statementDay!, stmtDebt.dueDay ?? stmtDebt.statementDay!, key);
            await setDebtCycle(stmtDebt.id, key, { ...dates, statementBalance: bal, minimumDue: min });
            setStmtDebt(null);
          }}
          onCancel={() => setStmtDebt(null)}
        />
      )}
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
    </>
  );
}
