import { useEffect, useState } from "react";
import { monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { cutoffSummary, isCutoffClosed } from "../lib/selectors";
import { cycleMinimums } from "../lib/cycles";
import { LINE_SORTS, parseLineSortKey, type LineSortKey } from "../lib/lineSort";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { debtsCol, eventsCol, expensesCol, monthDoc, templateLines } from "../lib/paths";
import { deleteMonthLine, deleteTemplateLine, restartMonth, skipLineForMonth, syncMonthFromTemplate, toggleLinePaid } from "../lib/repo";
import { showToast } from "../lib/toast";
import type { Debt, DebtCycle, EventItem, Expense, MonthLine, TemplateLine } from "../lib/types";
import { useMonth } from "./MonthProvider";
import HeaderBand from "./HeaderBand";
import CutoffSection from "./CutoffSection";
import type { PaymentRec } from "./DebtPlan";
import DueSoonStrip from "./DueSoonStrip";
import AddOneOff from "./AddOneOff";
import EditLineDialog from "./EditLineDialog";
import ConfirmDialog from "./ConfirmDialog";

export default function ThisMonth() {
  const { viewedKey, currentKey, mode, editable, lines, skippedLines, incomes, ready, goPrev, goNext, start } = useMonth();
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const cycles = useCollectionGroup<DebtCycle>("cycles");
  // Net = what's still owed on each entered statement minimum; gross = the full
  // minimum (start-of-cutoff view for SendPlan's "full" mode).
  const cycleMins = cycleMinimums(debts, cycles, payments, new Date());
  const cycleMinsGross = cycleMinimums(debts, cycles, [], new Date());
  const expenses = useCollection<Expense>(expensesCol());
  const meta = useDoc<{ receivedIncomes?: Record<string, boolean> }>(monthDoc(viewedKey));
  const received = meta?.receivedIncomes ?? {};
  // For projected months the plan is forward-simulated from these globals:
  const template = useCollection<TemplateLine>(templateLines());
  const events = useCollection<EventItem>(eventsCol());
  const [adding, setAdding] = useState(false);
  const [editingLine, setEditingLine] = useState<MonthLine | null>(null);
  const [lineSort, setLineSortState] = useState<LineSortKey>(() => parseLineSortKey(localStorage.getItem("month-line-sort")));
  const setLineSort = (k: LineSortKey) => {
    setLineSortState(k);
    localStorage.setItem("month-line-sort", k);
  };
  const [confirmLine, setConfirmLine] = useState<MonthLine | null>(null);
  const [busyIncome, setBusyIncome] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Closed cutoffs start collapsed so the open cutoff sits on top. Initialized
  // on load / month change only — ticking a cutoff closed mid-session must not
  // snap it shut. null = not yet initialized (render falls back to live state).
  const [collapsed, setCollapsed] = useState<Record<1 | 2, boolean> | null>(null);
  useEffect(() => {
    if (!ready) return;
    // Only a fully-ticked (closed) cutoff starts collapsed; the open one stays expanded,
    // regardless of today's date. (Date-based auto-collapse hid cutoff 1 on days outside 13–24.)
    setCollapsed({ 1: isCutoffClosed(lines, 1), 2: isCutoffClosed(lines, 2) });
    // Re-init on month change only — `lines` deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, viewedKey]);
  const toggleCutoff = (c: 1 | 2) => setCollapsed((prev) => {
    const base = prev ?? { 1: isCutoffClosed(lines, 1), 2: isCutoffClosed(lines, 2) };
    return { ...base, [c]: !base[c] };
  });

  const projected = mode === "projected";

  const modeLabel = mode === "past" ? "history" : projected ? "projected" : "started early";
  const navLeft = (
    <button
      onClick={goPrev}
      aria-label="Previous month"
      className="h-9 w-9 flex items-center justify-center rounded-full bg-white/20 text-white text-lg active:bg-white/30"
    >‹</button>
  );
  const navRight = (
    <button
      onClick={goNext}
      aria-label="Next month"
      className="h-9 w-9 flex items-center justify-center rounded-full bg-white/20 text-white text-lg active:bg-white/30"
    >›</button>
  );

  if (!ready) {
    return (
      <main className="p-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex items-center justify-center gap-2 mb-4">
          {navLeft}
          <h1 className="text-xl font-bold leading-tight min-w-[9rem] text-center">{monthLabel(viewedKey)}</h1>
          {navRight}
        </div>
        <div className="p-6 text-center text-stone-500">Setting up {monthLabel(viewedKey)}…</div>
      </main>
    );
  }

  const totalSurplus = cutoffSummary(lines, incomes, 1, received).surplus + cutoffSummary(lines, incomes, 2, received).surplus;

  return (
    <>
      <HeaderBand
        title="TOTAL SURPLUS"
        value={peso(totalSurplus)}
        sub={`${monthLabel(viewedKey)}${mode !== "current" ? ` · ${modeLabel}` : ""}`}
        left={navLeft}
        right={navRight}
      />
      <main className="p-4">
      {mode === "current" && <DueSoonStrip />}

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
            <button onClick={() => setConfirmRestart(true)} className="font-semibold text-red-600">Restart month</button>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Tip: long-press a line to rename or change its amount for this month.</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[11px] text-stone-400">Sort</span>
        <div className="flex rounded-full bg-stone-100 p-0.5 text-[11px] font-semibold">
          {LINE_SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setLineSort(s.key)}
              className={`px-2.5 py-0.5 rounded-full ${lineSort === s.key ? "bg-white shadow text-stone-700" : "text-stone-400"}`}
            >{s.label}</button>
          ))}
        </div>
      </div>

      {([1, 2] as const).map((cutoff) => (
        <CutoffSection
          key={cutoff}
          cutoff={cutoff}
          lines={lines}
          skippedLines={skippedLines}
          incomes={incomes}
          expenses={expenses}
          debts={debts}
          payments={payments}
          cycleMins={cycleMins}
          cycleMinsGross={cycleMinsGross}
          received={received}
          viewedKey={viewedKey}
          currentKey={currentKey}
          mode={mode}
          editable={editable}
          projected={projected}
          template={template}
          events={events}
          lineSort={lineSort}
          collapsed={collapsed}
          toggleCutoff={toggleCutoff}
          busyIncome={busyIncome}
          setBusyIncome={setBusyIncome}
          setEditingLine={setEditingLine}
          setConfirmLine={setConfirmLine}
        />
      ))}

      {adding && <AddOneOff monthKey={viewedKey} lines={lines} onClose={() => setAdding(false)} />}
      {editingLine && <EditLineDialog monthKey={viewedKey} line={editingLine} onClose={() => setEditingLine(null)} />}
      {confirmLine && (
        <ConfirmDialog
          title={`Remove ${confirmLine.name}?`}
          message="Skip it for this month only, or delete it from your recurring template so it stops appearing in future months too."
          confirmLabel="Just this month"
          secondaryLabel="Remove from template too"
          onConfirm={async () => {
            await skipLineForMonth(viewedKey, confirmLine);
            setConfirmLine(null);
          }}
          onSecondary={async () => {
            // Reverse a logged debt payment before the line disappears, so the
            // debt's balance and its payment history stay consistent.
            if (confirmLine.status !== "" && confirmLine.debtId) {
              await toggleLinePaid(viewedKey, confirmLine);
            }
            await deleteTemplateLine(confirmLine.id);
            // Delete the month line directly: template sync leaves `overridden`
            // lines alone, so an inline-edited line would otherwise survive.
            await deleteMonthLine(viewedKey, confirmLine.id);
            await syncMonthFromTemplate(viewedKey);
            setConfirmLine(null);
          }}
          onCancel={() => setConfirmLine(null)}
        />
      )}
      {confirmRestart && (
        <ConfirmDialog
          title={`Restart ${monthLabel(viewedKey)}?`}
          message="Lines are regenerated fresh from your template: ticks, inline edits, skips, and one-offs are cleared, and the debt payments and savings moves made by ticking are rolled back. Logged expenses are kept. A backup is saved first (Settings → Backups)."
          confirmLabel="Restart"
          onConfirm={async () => {
            try {
              await restartMonth(viewedKey);
            } catch (err) {
              console.error(err);
              showToast("Restart failed — nothing was changed");
            }
            setConfirmRestart(false);
          }}
          onCancel={() => setConfirmRestart(false)}
        />
      )}
      </main>
    </>
  );
}
