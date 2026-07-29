import { useState } from "react";
import { useCollection } from "../../hooks/useCollection";
import { useAccounts } from "../AccountsProvider";
import { currentMonthKey } from "../../lib/clock";
import { peso } from "../../lib/format";
import { categoriesCol, debtsCol, monthLines } from "../../lib/paths";
import { activeLines } from "../../lib/selectors";
import type { Category, Debt, Expense, MonthLine } from "../../lib/types";
import ChannelIcon from "../ChannelIcon";
import EditExpenseDialog from "../EditExpenseDialog";

const MAX_RESULTS = 50;

/** Full-history expense search: case-insensitive substring match over note,
 *  category, channel, and the peso amount, across every month (the full
 *  collection is already subscribed client-side). Tap a result to edit it. */
export default function ExpenseSearch({ expenses }: { expenses: Expense[] }) {
  const { chip, label } = useAccounts();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Expense | null>(null);
  const categories = useCollection<Category>(categoriesCol());
  const allLines = useCollection<MonthLine>(monthLines(currentMonthKey()));
  const lines = activeLines(allLines);
  const debts = useCollection<Debt>(debtsCol());
  const activeDebts = debts.filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);

  const q = query.trim().toLowerCase();
  const results = q === "" ? [] : [...expenses]
    .filter((e) =>
      e.note.toLowerCase().includes(q)
      || e.category.toLowerCase().includes(q)
      || String(e.channel).toLowerCase().includes(q)
      || peso(e.amount).toLowerCase().includes(q)
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const shown = results.slice(0, MAX_RESULTS);

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold text-sm mb-3">Search expenses</h2>
      <input
        placeholder="Search expenses — note, category, account…"
        value={query} onChange={(e) => setQuery(e.target.value)}
        className="w-full text-sm border-b border-stone-200 pb-1 outline-none focus:border-emerald-500 mb-3"
      />
      {q !== "" && (
        <ul className="flex flex-col gap-1.5">
          {shown.map((e) => (
            <li key={e.id} className="bg-stone-50 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2.5">
              <button onClick={() => setEditing(e)} className="flex items-center justify-between gap-2.5 min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2.5 min-w-0">
                  <ChannelIcon channel={String(e.channel)} initial={e.category.charAt(0).toUpperCase()} chipClass={chip(e.channel)} />
                  <span className="text-sm truncate min-w-0">
                    <span className="block truncate">
                      {e.date.slice(5, 10)} · {e.category}{e.note ? ` · ${e.note}` : ""}
                    </span>
                    <span className="block text-[10px] text-stone-400">{label(e.channel)}</span>
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums shrink-0">{peso(e.amount)}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="text-xs text-stone-400 px-1">No matching expenses.</li>}
          {results.length > MAX_RESULTS && (
            <li className="text-[11px] text-stone-400 px-1 pt-1">showing {MAX_RESULTS} of {results.length}</li>
          )}
        </ul>
      )}
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
