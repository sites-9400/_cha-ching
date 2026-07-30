import { useAccounts } from "./AccountsProvider";
import { peso } from "../lib/format";
import type { Expense } from "../lib/types";
import ChannelIcon from "./ChannelIcon";

/** One tappable expense row, shared by the calendar's month/day lists and by
 *  expense search. `showDate` prefixes MM-DD — leave it off where the date is
 *  already known from context, as on a selected calendar day. Callers supply
 *  the `key`. */
export default function ExpenseRow(
  { expense, onClick, showDate = false }: {
    expense: Expense;
    onClick: () => void;
    showDate?: boolean;
  },
) {
  const { chip, label } = useAccounts();
  return (
    <li className="bg-stone-50 rounded-2xl px-3 py-2.5 flex items-center justify-between gap-2.5">
      <button onClick={onClick} className="flex items-center justify-between gap-2.5 min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2.5 min-w-0">
          <ChannelIcon
            channel={String(expense.channel)}
            initial={expense.category.charAt(0).toUpperCase()}
            chipClass={chip(expense.channel)}
          />
          <span className="text-sm truncate min-w-0">
            <span className="block truncate">
              {showDate ? `${expense.date.slice(5, 10)} · ` : ""}
              {expense.category}{expense.note ? ` · ${expense.note}` : ""}
            </span>
            <span className="block text-[10px] text-stone-400">{label(expense.channel)}</span>
          </span>
        </span>
        <span className="text-sm font-semibold tabular-nums shrink-0">{peso(expense.amount)}</span>
      </button>
    </li>
  );
}
