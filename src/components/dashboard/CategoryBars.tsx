import { useState } from "react";
import { peso } from "../../lib/format";
import { categoryTotals } from "../../lib/stats";
import type { Category, Channel } from "../../lib/types";

export interface DashExpense {
  id: string; amount: number; category: string; date: string; note?: string;
  envelopeLineId?: string; channel: Channel;
}

/** This month's unplanned spending by category (single-hue bars); tap to see notes.
 *  Categories with a monthly budget scale their bar to spent/budget and turn red past 100%. */
export default function CategoryBars(
  { expenses, monthKey, categories }: { expenses: DashExpense[]; monthKey: string; categories: Category[] },
) {
  const totals = categoryTotals(expenses, monthKey);
  const [open, setOpen] = useState<string | null>(null);
  const max = totals.reduce((m, t) => Math.max(m, t.total), 0) || 1;
  const budgetOf = new Map(categories.map((c) => [c.name, c.budget]));

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
            const budget = budgetOf.get(t.category);
            const hasBudget = !!budget && budget > 0;
            const pct = hasBudget ? Math.min(100, (t.total / budget) * 100) : (t.total / max) * 100;
            const barColor = hasBudget && t.total > budget ? "bg-red-500" : "bg-emerald-500";
            const rightLabel = hasBudget ? `${peso(t.total)} of ${peso(budget)}` : peso(t.total);
            return (
              <li key={t.category}>
                <button onClick={() => setOpen(isOpen ? null : t.category)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{t.category}</span>
                    <span className="tabular-nums">{rightLabel}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
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
