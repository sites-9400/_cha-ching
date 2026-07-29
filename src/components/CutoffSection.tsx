import { peso } from "../lib/format";
import { cutoffSummary, envelopeSpent, groupSpent, isCutoffClosed, unplannedForCutoff } from "../lib/selectors";
import { projectMonthPlan } from "../lib/project";
import { lineComparators, type LineSortKey } from "../lib/lineSort";
import { deleteMonthIncome, deleteMonthLine, setIncomeReceived, unskipLine } from "../lib/repo";
import type { Debt, EventItem, Expense, Income, MonthLine, TemplateLine } from "../lib/types";
import type { MonthMode } from "./MonthProvider";
import LineRow from "./LineRow";
import DebtPlan, { type PaymentRec } from "./DebtPlan";
import SendPlan from "./SendPlan";

/** One cutoff's income list, line rows, debt/send plans, and summary — the
 *  body of ThisMonth's per-cutoff map, extracted verbatim. */
export default function CutoffSection(
  {
    cutoff, lines, skippedLines, incomes, expenses, debts, payments, cycleMins, cycleMinsGross, received,
    viewedKey, currentKey, mode, editable, projected, template, events, lineSort,
    collapsed, toggleCutoff, busyIncome, setBusyIncome, setEditingLine, setConfirmLine,
  }: {
    cutoff: 1 | 2;
    lines: MonthLine[];
    skippedLines: MonthLine[];
    incomes: Income[];
    expenses: Expense[];
    debts: Debt[];
    payments: PaymentRec[];
    cycleMins?: ReadonlyMap<string, number>;
    cycleMinsGross?: ReadonlyMap<string, number>;
    received: Record<string, boolean>;
    viewedKey: string;
    currentKey: string;
    mode: MonthMode;
    editable: boolean;
    projected: boolean;
    template: TemplateLine[];
    events: EventItem[];
    lineSort: LineSortKey;
    collapsed: Record<1 | 2, boolean> | null;
    toggleCutoff: (c: 1 | 2) => void;
    busyIncome: string | null;
    setBusyIncome: (id: string | null) => void;
    setEditingLine: (l: MonthLine) => void;
    setConfirmLine: (l: MonthLine) => void;
  },
) {
  const s = cutoffSummary(lines, incomes, cutoff, received);
  const unplanned = editable ? unplannedForCutoff(expenses, viewedKey, cutoff, lines) : 0;
  const freeCash = Math.max(0, s.surplus - unplanned);
  const pct = s.planned > 0 ? Math.round((s.ticked / s.planned) * 100) : 0;
  const cutLines = lines.filter((l) => l.cutoff === cutoff).sort(lineComparators[lineSort]);
  const cutSkipped = skippedLines.filter((l) => l.cutoff === cutoff);
  const cutIncomes = incomes.filter((i) => i.cutoff === cutoff).sort((a, b) => a.day - b.day);
  const proj = projected ? projectMonthPlan(viewedKey, currentKey, debts, template, events, incomes) : null;
  const projAlloc = proj ? (cutoff === 1 ? proj.alloc.c1 : proj.alloc.c2) : null;
  const closed = isCutoffClosed(lines, cutoff);
  const isCollapsed = collapsed ? collapsed[cutoff] : closed;

  if (isCollapsed) {
    return (
      <section className="mb-6">
        <button
          onClick={() => toggleCutoff(cutoff)}
          className="w-full bg-white rounded-2xl shadow px-4 py-3 flex items-center justify-between"
        >
          <span className="font-semibold flex items-center gap-2 text-sm">
            {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
            {closed && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ CLOSED</span>
            )}
          </span>
          <span className="text-sm text-stone-400 flex items-center gap-2">
            <span className="tabular-nums text-emerald-700 font-semibold">{peso(s.surplus)}</span>
            ▸
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="mb-6 bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold mb-1 flex items-center gap-2">
        <button onClick={() => toggleCutoff(cutoff)} className="flex items-center gap-2">
          {cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}
          {editable && closed && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ CLOSED</span>
          )}
          <span className="text-stone-300 text-xs">▾</span>
        </button>
      </h2>
      {editable && (
        <div className="h-2 rounded-full bg-stone-100 mb-3 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      {cutIncomes.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {cutIncomes.map((i) => (
            <IncomeRow
              key={i.id}
              income={i}
              viewedKey={viewedKey}
              editable={editable}
              busyIncome={busyIncome}
              setBusyIncome={setBusyIncome}
              received={received[i.id] === true}
            />
          ))}
        </ul>
      )}
      <ul className="divide-y divide-stone-100">
        {cutLines.map((l) => (
          <LineRow
            key={l.id}
            monthKey={viewedKey}
            line={l}
            readOnly={!editable}
            spent={l.isEnvelope
              ? l.budgetGroup
                ? groupSpent(expenses, viewedKey, l.budgetGroup, lines)
                : envelopeSpent(expenses, viewedKey, l.id)
              : undefined}
            budgetTotal={l.isEnvelope
              ? l.budgetGroup
                // Only ticked (on-hand) lines fund the pool — matches unplannedForCutoff.
                ? lines.filter((x) => x.isEnvelope && x.budgetGroup === l.budgetGroup && x.status !== "")
                    .reduce((s, x) => s + x.amount, 0)
                : (l.status !== "" ? l.amount : 0)
              : undefined}
            onDelete={editable && !closed
              ? (l.oneOff
                  ? () => void deleteMonthLine(viewedKey, l.id)
                  : () => setConfirmLine(l))
              : undefined}
            onEdit={editable ? () => setEditingLine(l) : undefined}
          />
        ))}
      </ul>

      {cutSkipped.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {cutSkipped.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-xs text-stone-400">
              <span className="truncate">{l.name} · skipped this month</span>
              {editable && (
                <button
                  onClick={() => void unskipLine(viewedKey, l.id)}
                  className="shrink-0 font-semibold text-emerald-700"
                >undo</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {mode !== "past" && !projected && (
        <>
          <DebtPlan freeCash={freeCash} debts={debts} payments={payments} monthKey={viewedKey} cutoff={cutoff} unplanned={unplanned} cycleMins={cycleMins} closed={closed} />
          <SendPlan freeCash={freeCash} debts={debts} payments={payments} lines={cutLines} monthKey={viewedKey} cutoff={cutoff} cycleMins={cycleMins} cycleMinsGross={cycleMinsGross} closed={closed} />
        </>
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
}

/** One income row within a cutoff: name, amount, receive toggle, delete (one-offs only). */
function IncomeRow(
  { income: i, viewedKey, editable, busyIncome, setBusyIncome, received: on }:
  { income: Income; viewedKey: string; editable: boolean; busyIncome: string | null;
    setBusyIncome: (id: string | null) => void; received: boolean },
) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="truncate text-emerald-800">
        ↓ {i.name}
        {i.toSavings && <span className="ml-1 text-[10px] text-cyan-700">→ savings</span>}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="tabular-nums text-emerald-800">{peso(i.amount)}</span>
        {editable && (
          <button
            onClick={() => {
              if (busyIncome === i.id) return;
              setBusyIncome(i.id);
              void setIncomeReceived(viewedKey, i, !on).finally(() => setBusyIncome(null));
            }}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${on ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-400"}`}
          >{on ? "RECEIVED" : "receive"}</button>
        )}
        {editable && i.oneOff && <button onClick={() => void deleteMonthIncome(viewedKey, i)} className="text-stone-300 text-xs">✕</button>}
      </span>
    </li>
  );
}
