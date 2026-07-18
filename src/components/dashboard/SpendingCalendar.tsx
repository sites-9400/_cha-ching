import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { currentMonthKey, monthLabel } from "../../lib/clock";
import { addMonths, peso } from "../../lib/format";
import { categoriesCol, monthLines } from "../../lib/paths";
import { dailyTotals } from "../../lib/stats";
import type { Category, MonthLine } from "../../lib/types";
import ChannelIcon from "../ChannelIcon";
import EditExpenseDialog from "../EditExpenseDialog";
import type { DashExpense } from "./CategoryBars";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Compact total for a filled day cell: "1.2k" for ≥1000, whole pesos otherwise. */
function compact(n: number): string {
  if (n >= 1000) {
    const s = (n / 1000).toFixed(1);
    return `${s.endsWith(".0") ? s.slice(0, -2) : s}k`;
  }
  return String(Math.round(n));
}

/** Month-grid (Mon-start) of Quick Add spending; tap a day to see + edit its expenses. */
export default function SpendingCalendar({ expenses }: { expenses: DashExpense[] }) {
  const { chip, label } = useAccounts();
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<DashExpense | null>(null);
  const categories = useCollection<Category>(categoriesCol());
  const lines = useCollection<MonthLine>(monthLines(monthKey));

  const totals = dailyTotals(expenses, monthKey);
  const [y, m] = monthKey.split("-").map(Number);
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const dayExpenses = openDay === null ? [] : expenses
    .filter((e) => e.date.slice(0, 7) === monthKey && Number(e.date.slice(8, 10)) === openDay)
    .sort((a, b) => b.date.localeCompare(a.date));

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
      {openDay !== null && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {dayExpenses.map((e) => (
            <li key={e.id} className="bg-stone-50 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2.5">
              <button onClick={() => setEditing(e)} className="flex items-center justify-between gap-2.5 min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2.5 min-w-0">
                  <ChannelIcon channel={String(e.channel)} initial={e.category.charAt(0).toUpperCase()} chipClass={chip(e.channel)} />
                  <span className="text-sm truncate min-w-0">
                    <span className="block truncate">{e.category}{e.note ? ` · ${e.note}` : ""}</span>
                    <span className="block text-[10px] text-stone-400">{label(e.channel)}</span>
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums shrink-0">{peso(e.amount)}</span>
              </button>
            </li>
          ))}
          {dayExpenses.length === 0 && <li className="text-xs text-stone-400 px-1">No expenses that day.</li>}
        </ul>
      )}
      {editing && (
        <EditExpenseDialog
          expense={{ ...editing, note: editing.note ?? "" }}
          categories={categories} lines={lines}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
