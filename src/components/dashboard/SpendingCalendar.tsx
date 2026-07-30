import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { currentMonthKey, monthLabel } from "../../lib/clock";
import { addMonths, peso } from "../../lib/format";
import { categoriesCol, debtsCol, monthLines } from "../../lib/paths";
import { activeLines, monthExpenses } from "../../lib/selectors";
import { dailyTotals } from "../../lib/stats";
import type { Category, Debt, Expense, MonthLine } from "../../lib/types";
import EditExpenseDialog from "../EditExpenseDialog";
import ExpenseRow from "../ExpenseRow";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Compact total for a filled day cell: "1.2k" for ≥1000, whole pesos otherwise. */
function compact(n: number): string {
  if (n >= 1000) {
    const s = (n / 1000).toFixed(1);
    return `${s.endsWith(".0") ? s.slice(0, -2) : s}k`;
  }
  return String(Math.round(n));
}

/** Month-grid (Mon-start) of Quick Add spending. The whole month is listed
 *  below the grid; tapping a day narrows the list to that day, tapping it again
 *  restores the month. Any row opens the edit dialog. */
export default function SpendingCalendar({ expenses }: { expenses: Expense[] }) {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const categories = useCollection<Category>(categoriesCol());
  const allLines = useCollection<MonthLine>(monthLines(monthKey));
  const lines = activeLines(allLines);
  const debts = useCollection<Debt>(debtsCol());
  const activeDebts = debts.filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);

  const totals = dailyTotals(expenses, monthKey);
  const [y, m] = monthKey.split("-").map(Number);
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // The day list is derived from the month list, so the filter-and-sort happens
  // once and both views stay in the same order.
  const month = monthExpenses(expenses, monthKey);
  const dayItems = openDay === null
    ? []
    : month.items.filter((e) => Number(e.date.slice(8, 10)) === openDay);
  const shown = openDay === null ? month.items : dayItems;
  const shownTotal = openDay === null
    ? month.total
    : dayItems.reduce((s, e) => s + e.amount, 0);

  function goToMonth(delta: -1 | 1) {
    setMonthKey((k) => addMonths(k, delta));
    setOpenDay(null);
  }

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold text-sm mb-3">Spending calendar</h2>
      <div className="flex items-center justify-center gap-2 mb-3">
        <button onClick={() => goToMonth(-1)} className="h-8 w-8 rounded-full bg-white shadow text-emerald-700">‹</button>
        <span className="text-sm font-semibold min-w-[8rem] text-center">{monthLabel(monthKey)}</span>
        <button onClick={() => goToMonth(1)} className="h-8 w-8 rounded-full bg-white shadow text-emerald-700">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[9px] text-stone-400 text-center uppercase">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`b${i}`} />)}
        {days.map((day) => {
          const hasSpend = totals.has(day);
          const isOpen = openDay === day;
          return (
            <button
              key={day}
              onClick={() => setOpenDay(isOpen ? null : day)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 ${
                hasSpend ? "bg-emerald-100 text-emerald-800 font-semibold" : "text-stone-500"
              } ${isOpen ? "ring-2 ring-emerald-500" : ""}`}
            >
              <span className="text-[11px]">{day}</span>
              {hasSpend && <span className="text-[9px] tabular-nums">{compact(totals.get(day) ?? 0)}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-baseline justify-between text-[11px]">
        <span className="font-semibold">
          {openDay === null ? `All of ${monthLabel(monthKey)}` : `${monthLabel(monthKey)} · ${openDay}`}
        </span>
        <span className="text-stone-400 tabular-nums">{shown.length} · {peso(shownTotal)}</span>
      </div>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {shown.map((e) => (
          <ExpenseRow key={e.id} expense={e} onClick={() => setEditing(e)} showDate={openDay === null} />
        ))}
        {shown.length === 0 && (
          <li className="text-xs text-stone-400 px-1">
            {openDay === null ? `No expenses in ${monthLabel(monthKey)}.` : "No expenses that day."}
          </li>
        )}
      </ul>
      {editing && (
        <EditExpenseDialog
          expense={editing}
          categories={categories} lines={lines} debts={activeDebts}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
