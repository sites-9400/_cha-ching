import { monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { cutoffSummary, unplannedForCutoff } from "../lib/selectors";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { debtsCol, expensesCol, monthDoc } from "../lib/paths";
import { setIncomeReceived } from "../lib/repo";
import type { Debt } from "../lib/types";
import { useMonth } from "./MonthProvider";
import LineRow from "./LineRow";
import DebtPlan, { type PaymentRec } from "./DebtPlan";

export default function ThisMonth() {
  const { monthKey, lines, incomes, ready } = useMonth();
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const expenses = useCollection<{ id: string; amount: number; date: string }>(expensesCol());
  const meta = useDoc<{ receivedIncomes?: Record<string, boolean> }>(monthDoc(monthKey));
  const received = meta?.receivedIncomes ?? {};

  if (!ready) {
    return <div className="p-6 text-center text-stone-500">Setting up {monthLabel(monthKey)}…</div>;
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">{monthLabel(monthKey)}</h1>
      {([1, 2] as const).map((cutoff) => {
        const s = cutoffSummary(lines, incomes, cutoff);
        const unplanned = unplannedForCutoff(expenses, monthKey, cutoff);
        const freeCash = Math.max(0, s.surplus - unplanned);
        const pct = s.planned > 0 ? Math.round((s.ticked / s.planned) * 100) : 0;
        const cutLines = lines
          .filter((l) => l.cutoff === cutoff)
          .sort((a, b) => a.order - b.order);
        const cutIncomes = incomes
          .filter((i) => i.cutoff === cutoff)
          .sort((a, b) => a.day - b.day);
        return (
          <section key={cutoff} className="mb-6 bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-1">{cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}</h2>
            <div className="h-2 rounded-full bg-stone-100 mb-3 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            {cutIncomes.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {cutIncomes.map((i) => {
                  const on = received[i.id] === true;
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-emerald-800">↓ {i.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums text-emerald-800">{peso(i.amount)}</span>
                        <button
                          onClick={() => void setIncomeReceived(monthKey, i.id, !on)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${on ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-400"}`}
                        >
                          {on ? "RECEIVED" : "receive"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <ul className="divide-y divide-stone-100">
              {cutLines.map((l) => (
                <LineRow key={l.id} monthKey={monthKey} line={l} />
              ))}
            </ul>
            <DebtPlan
              freeCash={freeCash}
              debts={debts}
              payments={payments}
              monthKey={monthKey}
              cutoff={cutoff}
              unplanned={unplanned}
            />
            <p className="mt-3 text-sm flex justify-between font-semibold">
              <span>Income {peso(s.income)}</span>
              <span className="text-emerald-700">Surplus {peso(s.surplus)}</span>
            </p>
            <p className="text-xs text-stone-400 text-right mt-1">{pct}% ticked</p>
          </section>
        );
      })}
    </main>
  );
}
