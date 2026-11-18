import { peso } from "../lib/format";
import { groupOutflow, type OutflowScope } from "../lib/whereItGoes";
import type { MonthLine } from "../lib/types";

/** Ranked breakdown of where a cutoff's pesos go. Presentational only. */
export default function WhereItGoes(
  { lines, cutoff, title, total, income, left, onScope }:
  { lines: MonthLine[]; cutoff: OutflowScope; title?: string; total?: number; income?: number; left?: number;
    onScope?: (s: OutflowScope) => void },
) {
  const groups = groupOutflow(lines, cutoff);
  if (groups.length === 0) return null;
  const largest = groups[0].amount;
  const count = groups.reduce((s, g) => s + g.count, 0);
  return (
    <section aria-label="Where it goes" className="mb-4 rounded-xl border border-rule bg-manila p-4 shadow-card">
      {title != null && total != null && (
        <div className="mb-4 pb-4 border-b border-rule">
          {onScope && (
            <div role="tablist" aria-label="Which cutoff" className="mb-3 flex rounded-full border border-rule p-0.5 text-[12px] font-semibold">
              {([[1, "1st cutoff"], [2, "2nd cutoff"], ["month", "Whole month"]] as const).map(([k, lbl]) => (
                <button
                  key={String(k)}
                  role="tab"
                  aria-selected={cutoff === k}
                  onClick={() => onScope(k)}
                  className={`flex-1 h-9 rounded-full ${cutoff === k ? "bg-ink text-manila" : "text-ink-2"}`}
                >{lbl}</button>
              ))}
            </div>
          )}
          <h2 className="text-[15px] leading-5 font-medium text-ink">{title}</h2>
          <p className="font-display font-extrabold text-[44px] leading-none text-ink tabular-nums mt-1">{peso(total)}</p>
          {income != null && left != null && (
            <p className="mt-2 text-[13px] leading-5 text-ink-2">
              <span className="font-semibold text-marker-blue">Came in {peso(income)}</span> · Left {peso(left)}
            </p>
          )}
        </div>
      )}
      <h2 className="font-display font-bold text-[20px] leading-6 text-ink mb-3">Where it goes</h2>
      <ul className="flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-[15px] leading-5 text-ink">{g.label}</span>
              <span className="font-display font-bold text-[17px] leading-5 text-ink tabular-nums">{peso(g.amount)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-rule overflow-hidden">
              <div className="h-full bg-ink" style={{ width: `${(g.amount / largest) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-4 text-ink-2">Ranked by pesos · {count} lines{groups.some((g) => g.key === "other") ? " · set groups by long-pressing a line" : ""}</p>
    </section>
  );
}
