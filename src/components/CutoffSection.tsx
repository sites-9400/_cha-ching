import { peso } from "../lib/format";
import { cutoffSummary, envelopeSpent, groupSpent, isCutoffClosed, unplannedForCutoff } from "../lib/selectors";
import { projectMonthPlan } from "../lib/project";
import { lineComparators, type LineSortKey } from "../lib/lineSort";
import { deleteMonthIncome, setIncomeReceived, unskipLine } from "../lib/repo";
import type { Debt, EventItem, Expense, Income, MonthLine, TemplateLine } from "../lib/types";
import type { MonthMode } from "./MonthProvider";
import LineRow from "./LineRow";
import DebtPlan, { type PaymentRec } from "./DebtPlan";
import SendPlan from "./SendPlan";
import { XIcon } from "./LineRow";

function ClosedPill() {
  return <span className="font-sans text-[11px] leading-4 font-semibold px-2 py-0.5 rounded-full border border-ink-2 text-ink-2">Closed</span>;
}

/** Due-day window each cutoff covers, per cutoffForDueDay: days 13-24 are the 1st cutoff, the rest the 2nd. */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const cutoffRange = (c: 1 | 2, monthKey: string) => {
  const m = Number(monthKey.slice(5, 7)) - 1;
  const cur = MON[m] ?? "";
  const next = MON[(m + 1) % 12] ?? "";
  return c === 1 ? `${cur} 13 to 24` : `${cur} 25 to ${next} 12`;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/** One cutoff's income list, line rows, debt/send plans, and summary — the
 *  body of ThisMonth's per-cutoff map, extracted verbatim. */
export default function CutoffSection(
  {
    cutoff, lines, skippedLines, incomes, expenses, debts, payments, cycleMins, cycleMinsGross, received,
    viewedKey, currentKey, mode, editable, projected, template, events, lineSort,
    collapsed, toggleCutoff, busyIncome, setBusyIncome, setEditingLine,
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
          className="w-full bg-manila rounded-xl border border-rule shadow-card px-4 py-3 flex items-center justify-between"
        >
          <span className="flex flex-col items-start text-left">
            <span className="font-display font-bold text-[22px] leading-7 text-ink flex items-center gap-2 whitespace-nowrap">
              {cutoff === 1 ? "1st cutoff" : "2nd cutoff"}
              {closed && <ClosedPill />}
            </span>
            <span className="font-sans text-[13px] leading-5 font-medium text-ink-2 whitespace-nowrap">{cutoffRange(cutoff, viewedKey)}</span>
          </span>
          <span className="flex items-center gap-2 text-ink-2">
            <span className="font-display font-bold text-[22px] leading-7 text-ink">{peso(s.surplus)}</span>
            <Chevron open={false} />
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="mb-6 bg-manila rounded-xl border border-rule shadow-card p-4">
      <h2 className="font-display font-bold text-[22px] leading-7 text-ink mb-2">
        <button onClick={() => toggleCutoff(cutoff)} className="flex items-center gap-2">
          {cutoff === 1 ? "1st cutoff" : "2nd cutoff"}
          <span className="font-sans text-[13px] leading-5 font-medium text-ink-2">· {cutoffRange(cutoff, viewedKey)}</span>
          {editable && closed && <ClosedPill />}
          <span className="text-ink-2"><Chevron open /></span>
        </button>
      </h2>
      {editable && (
        <div className="mb-3">
          <div className="h-2 rounded-full bg-rule overflow-hidden">
            <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[12px] leading-4 text-ink-2 tabular-nums">{peso(s.ticked)} of {peso(s.planned)} paid</p>
        </div>
      )}
      <ul className="divide-y divide-rule">
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
            onEdit={editable ? () => setEditingLine(l) : undefined}
          />
        ))}
      </ul>

      {cutIncomes.length > 0 && (
        <><h3 className="mt-4 mb-1 font-display font-bold text-[16px] leading-5 text-ink">Came in</h3>
        <ul className="divide-y divide-rule">
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
        </ul></>
      )}

      {cutSkipped.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {cutSkipped.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-xs text-ink-2">
              <span className="truncate">{l.name} · skipped this month</span>
              {editable && (
                <button
                  onClick={() => void unskipLine(viewedKey, l.id)}
                  className="shrink-0 font-semibold text-ink"
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
        <div className="mt-3 border-t border-rule pt-3">
          <p className="font-display font-bold text-[16px] leading-5 text-ink mb-2">Projected plan · free cash {peso(cutoff === 1 ? proj!.free.c1 : proj!.free.c2)}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {projAlloc.lines.map((l) => (
              <li key={l.debtId} className="flex justify-between">
                <span className="text-ink-2">{l.name} <span className="text-[11px] text-ink-2">{l.kind}</span></span>
                <span className="font-display text-[17px] tabular-nums font-bold">{peso(l.amount)}</span>
              </li>
            ))}
            {projAlloc.lines.length === 0 && <li className="text-xs text-ink-2">No free cash this cutoff.</li>}
          </ul>
        </div>
      )}

      <p className="mt-3 pt-3 border-t border-rule flex justify-between items-baseline font-display font-bold text-[22px] leading-7">
        <span className="text-marker-blue">In {peso(s.income)}</span>
        <span className="text-ink">Surplus {peso(s.surplus)}</span>
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
    <li className="flex items-start gap-3 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-[16px] leading-6 font-medium text-ink">{i.name}</p>
        <p className="text-[12px] leading-4 text-ink-2">
          <span className="whitespace-nowrap">Day {i.day}</span>
          {i.toSavings && <span className="whitespace-nowrap"> · to savings</span>}
          {i.oneOff && <span className="whitespace-nowrap"> · one-off</span>}
          {editable && i.oneOff && (
            <>
              {" · "}
              <button onClick={() => void deleteMonthIncome(viewedKey, i)} aria-label={`Remove ${i.name}`} className="inline-flex items-center gap-0.5 font-semibold text-marker-red align-middle"><XIcon />Remove</button>
            </>
          )}
        </p>
      </div>
      <div className="w-[7.5rem] shrink-0 flex flex-col items-end gap-1">
        <span className="font-display font-bold text-[17px] leading-6 tabular-nums text-marker-blue">{peso(i.amount)}</span>
        {editable && (
          <button
            onClick={() => {
              if (busyIncome === i.id) return;
              setBusyIncome(i.id);
              void setIncomeReceived(viewedKey, i, !on).finally(() => setBusyIncome(null));
            }}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${on ? "bg-marker-blue text-manila" : "border border-rule text-ink-2"}`}
          >{on ? "Received" : "Receive"}</button>
        )}
      </div>
    </li>
  );
}
