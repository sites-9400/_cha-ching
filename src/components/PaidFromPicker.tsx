import type { Debt, MonthLine } from "../lib/types";
import { CreditCardIcon } from "./icons";

const chipCls = (on: boolean) =>
  `text-xs px-3 min-h-11 rounded-full transition-colors inline-flex items-center gap-1.5 ${
    on ? "bg-ink text-manila border border-ink" : "bg-manila text-stone-600 border border-rule"
  }`;

/** The Paid-from chip row: Unplanned, budget groups, envelope lines, Savings,
 *  then card-icon debt chips — shared by QuickAdd and EditExpenseDialog. */
export default function PaidFromPicker(
  { value, onPick, groups, envelopes, debts }:
  { value: string; onPick: (token: string) => void; groups: string[];
    envelopes: MonthLine[]; debts: Debt[] },
) {
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => onPick("")} className={chipCls(value === "")}>Unplanned</button>
      {groups.map((g) => (
        <button key={g} onClick={() => onPick(`@group:${g}`)} className={chipCls(value === `@group:${g}`)}>{g}</button>
      ))}
      {envelopes.map((l) => (
        <button key={l.id} onClick={() => onPick(l.id)} className={chipCls(value === l.id)}>{l.name}</button>
      ))}
      <button onClick={() => onPick("@savings")} className={chipCls(value === "@savings")}>Savings</button>
      {debts.map((d) => (
        <button key={d.id} onClick={() => onPick(`@debt:${d.id}`)} className={chipCls(value === `@debt:${d.id}`)}>
          <CreditCardIcon className="h-3.5 w-3.5 shrink-0" />{d.name}
        </button>
      ))}
    </div>
  );
}
