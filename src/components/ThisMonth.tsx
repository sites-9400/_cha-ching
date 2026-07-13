import { useState } from "react";
import { monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { cutoffSummary, unplannedForCutoff } from "../lib/selectors";
import { projectMonthPlan } from "../lib/project";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { debtsCol, eventsCol, expensesCol, monthDoc, templateLines } from "../lib/paths";
import { deleteMonthIncome, deleteMonthLine, setIncomeReceived, syncMonthFromTemplate } from "../lib/repo";
import type { Debt, EventItem, MonthLine, TemplateLine } from "../lib/types";
import { useMonth } from "./MonthProvider";
import LineRow from "./LineRow";
import DebtPlan, { type PaymentRec } from "./DebtPlan";
import AddOneOff from "./AddOneOff";
import EditLineDialog from "./EditLineDialog";

export default function ThisMonth() {
  const { viewedKey, currentKey, mode, editable, lines, incomes, ready, goPrev, goNext, start } = useMonth();
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const expenses = useCollection<{ id: string; amount: number; date: string }>(expensesCol());
  const meta = useDoc<{ receivedIncomes?: Record<string, boolean> }>(monthDoc(viewedKey));
  const received = meta?.receivedIncomes ?? {};
  // For projected months the plan is forward-simulated from these globals:
  const template = useCollection<TemplateLine>(templateLines());
  const events = useCollection<EventItem>(eventsCol());
  const [adding, setAdding] = useState(false);
  const [editingLine, setEditingLine] = useState<MonthLine | null>(null);

  const projected = mode === "projected";

  const header = (
    <div className="flex items-center justify-center gap-2 mb-4">
      <button
        onClick={goPrev}
        aria-label="Previous month"
        className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow text-emerald-700 text-xl active:bg-stone-100"
      >‹</button>
      <div className="text-center min-w-[9rem]">
        <h1 className="text-xl font-bold leading-tight">{monthLabel(viewedKey)}</h1>
        {mode !== "current" && (
          <span className="text-[11px] uppercase tracking-wide text-stone-400">
            {mode === "past" ? "history" : projected ? "projected" : "started early"}
          </span>
        )}
      </div>
      <button
        onClick={goNext}
        aria-label="Next month"
        className="h-10 w-10 flex items-center justify-center rounded-full bg-white shadow text-emerald-700 text-xl active:bg-stone-100"
      >›</button>
    </div>
  );

  if (!ready) {
    return <main className="p-4">{header}<div className="p-6 text-center text-stone-500">Setting up {monthLabel(viewedKey)}…</div></main>;
  }

  return (
    <main className="p-4">
      {header}

      {projected && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          Projected from your template + this month's events. Nothing here is saved.
          <button onClick={start} className="block mt-2 font-semibold text-emerald-700">Start {monthLabel(viewedKey)} →</button>
        </div>
      )}

      {editable && (
        <div className="mb-3">
          <div className="flex gap-3 text-sm">
            <button onClick={() => setAdding(true)} className="font-semibold text-emerald-700">+ Add one-off</button>
            {mode === "current" && (
              <button onClick={() => void syncMonthFromTemplate(viewedKey)} className="font-semibold text-stone-500">Sync from template</button>
            )}
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Tip: long-press a line to rename or change its amount for this month.</p>
        </div>
      )}

      {([1, 2] as const).map((cutoff) => {
        const s = cutoffSummary(lines, incomes, cutoff);
        const unplanned = editable ? unplannedForCutoff(expenses, viewedKey, cutoff) : 0;
        const freeCash = Math.max(0, s.surplus - unplanned);
        const pct = s.planned > 0 ? Math.round((s.ticked / s.planned) * 100) : 0;
        const cutLines = lines.filter((l) => l.cutoff === cutoff).sort((a, b) => a.order - b.order);
        const cutIncomes = incomes.filter((i) => i.cutoff === cutoff).sort((a, b) => a.day - b.day);
        const proj = projected ? projectMonthPlan(viewedKey, currentKey, debts, template, events, incomes) : null;
        const projAlloc = proj ? (cutoff === 1 ? proj.alloc.c1 : proj.alloc.c2) : null;

        return (
          <section key={cutoff} className="mb-6 bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-1">{cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}</h2>
            {editable && (
              <div className="h-2 rounded-full bg-stone-100 mb-3 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            {cutIncomes.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {cutIncomes.map((i) => {
                  const on = received[i.id] === true;
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-emerald-800">↓ {i.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums text-emerald-800">{peso(i.amount)}</span>
                        {editable && (
                          <button
                            onClick={() => void setIncomeReceived(viewedKey, i.id, !on)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${on ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-400"}`}
                          >{on ? "RECEIVED" : "receive"}</button>
                        )}
                        {editable && <button onClick={() => void deleteMonthIncome(viewedKey, i.id)} className="text-stone-300 text-xs">✕</button>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <ul className="divide-y divide-stone-100">
              {cutLines.map((l) => (
                <LineRow
                  key={l.id}
                  monthKey={viewedKey}
                  line={l}
                  readOnly={!editable}
                  onDelete={editable && l.oneOff ? () => void deleteMonthLine(viewedKey, l.id) : undefined}
                  onEdit={editable ? () => setEditingLine(l) : undefined}
                />
              ))}
            </ul>

            {mode !== "past" && !projected && (
              <DebtPlan freeCash={freeCash} debts={debts} payments={payments} monthKey={viewedKey} cutoff={cutoff} unplanned={unplanned} />
            )}
            {projected && projAlloc && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-500 mb-2">PROJECTED PLAN · free cash {peso(cutoff === 1 ? proj!.free.c1 : proj!.free.c2)}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {projAlloc.lines.map((l) => (
                    <li key={l.debtId} className="flex justify-between">
                      <span className="text-stone-600">{l.name} <span className="text-[10px] text-stone-400">{l.kind}</span></span>
                      <span className="tabular-nums font-semibold">{peso(l.amount)}</span>
                    </li>
                  ))}
                  {projAlloc.lines.length === 0 && <li className="text-xs text-stone-400">No free cash this cutoff.</li>}
                </ul>
              </div>
            )}

            <p className="mt-3 text-sm flex justify-between font-semibold">
              <span>Income {peso(s.income)}</span>
              <span className="text-emerald-700">Surplus {peso(s.surplus)}</span>
            </p>
          </section>
        );
      })}

      {adding && <AddOneOff monthKey={viewedKey} onClose={() => setAdding(false)} />}
      {editingLine && <EditLineDialog monthKey={viewedKey} line={editingLine} onClose={() => setEditingLine(null)} />}
    </main>
  );
}
