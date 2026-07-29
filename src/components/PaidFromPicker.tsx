import type { Debt, MonthLine } from "../lib/types";

/** The Paid-from chip row: Unplanned, budget groups, envelope lines, Savings,
 *  then 💳 debt chips — shared by QuickAdd and EditExpenseDialog. */
export default function PaidFromPicker(
  { value, onPick, groups, envelopes, debts }:
  { value: string; onPick: (token: string) => void; groups: string[];
    envelopes: MonthLine[]; debts: Debt[] },
) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onPick("")}
        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
          value === "" ? "bg-stone-700 text-white" : "bg-stone-100 text-stone-600"
        }`}
      >Unplanned</button>
      {groups.map((g) => (
        <button
          key={g} onClick={() => onPick(`@group:${g}`)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            value === `@group:${g}` ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
          }`}
        >{g}</button>
      ))}
      {envelopes.map((l) => (
        <button
          key={l.id} onClick={() => onPick(l.id)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            value === l.id ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"
          }`}
        >{l.name}</button>
      ))}
      <button
        onClick={() => onPick("@savings")}
        className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
          value === "@savings" ? "bg-cyan-600 text-white" : "bg-stone-100 text-stone-600"
        }`}
      >Savings</button>
      {debts.map((d) => (
        <button
          key={d.id} onClick={() => onPick(`@debt:${d.id}`)}
          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
            value === `@debt:${d.id}` ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-600"
          }`}
        >💳 {d.name}</button>
      ))}
    </div>
  );
}
