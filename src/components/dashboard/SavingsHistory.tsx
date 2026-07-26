import { useCollection } from "../../hooks/useCollection";
import { peso } from "../../lib/format";
import { savingsMovesCol } from "../../lib/paths";
import { deleteSavingsMove } from "../../lib/repo";
import { savingsHistory } from "../../lib/savings";
import type { SavingsMove } from "../../lib/types";

interface SavingsExpense {
  id: string; amount: number; date: string; note?: string; category?: string; fundedBySavings?: boolean;
}

export default function SavingsHistory({ expenses }: { expenses: readonly SavingsExpense[] }) {
  const moves = useCollection<SavingsMove>(savingsMovesCol());
  const byId = new Map(moves.map((m) => [m.id, m]));
  const rows = savingsHistory(moves, expenses);

  if (rows.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold text-sm mb-2">Recent</h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-stone-400 text-xs w-14 shrink-0 tabular-nums">{r.date.slice(5, 10)}</span>
            <span className="truncate flex-1">{r.source}</span>
            <span className={`tabular-nums shrink-0 ${r.direction === "in" ? "text-emerald-700" : "text-stone-500"}`}>
              {r.direction === "in" ? "+" : "−"}{peso(r.amount)}
            </span>
            {r.kind === "move" && (
              <button
                onClick={() => { const m = byId.get(r.id); if (m) void deleteSavingsMove(m); }}
                className="text-stone-300 text-xs pl-1"
              >✕</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
