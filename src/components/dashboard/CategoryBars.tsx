import { useState } from "react";
import { peso } from "../../lib/format";
import { categoryTotals } from "../../lib/stats";

export interface DashExpense {
  id: string; amount: number; category: string; date: string; note?: string;
}

/** This month's unplanned spending by category (single-hue bars); tap to see notes. */
export default function CategoryBars({ expenses, monthKey }: { expenses: DashExpense[]; monthKey: string }) {
  const totals = categoryTotals(expenses, monthKey);
  const [open, setOpen] = useState<string | null>(null);
  const max = totals.reduce((m, t) => Math.max(m, t.total), 0) || 1;

  return (
    <section className="bg-white rounded-xl shadow p-4">
      <h2 className="font-semibold text-sm mb-3">Spending by category</h2>
      {totals.length === 0 ? (
        <p className="text-xs text-stone-400">No spending logged this month.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {totals.map((t) => {
            const items = expenses
              .filter((e) => e.category === t.category && e.date.slice(0, 7) === monthKey)
              .sort((a, b) => b.date.localeCompare(a.date));
            const isOpen = open === t.category;
            return (
              <li key={t.category}>
                <button onClick={() => setOpen(isOpen ? null : t.category)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{t.category}</span>
                    <span className="tabular-nums">{peso(t.total)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(t.total / max) * 100}%` }} />
                  </div>
                </button>
                {isOpen && (
                  <ul className="mt-1.5 mb-1 pl-2 flex flex-col gap-0.5">
                    {items.map((e) => (
                      <li key={e.id} className="flex items-center justify-between text-[11px] text-stone-500">
                        <span className="truncate">
                          {e.date.slice(5, 10)}{e.note ? ` · ${e.note}` : ""}
                        </span>
                        <span className="tabular-nums shrink-0">{peso(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
