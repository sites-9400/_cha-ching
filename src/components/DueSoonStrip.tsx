import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { debtsCol } from "../lib/paths";
import { currentCycleKey, cycleDates, daysUntil, paidInCycle } from "../lib/cycles";
import { peso } from "../lib/format";
import type { Debt, DebtCycle } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";

/** Cards due within 7 days whose current-cycle minimum isn't fully paid. */
export default function DueSoonStrip() {
  const debts = useCollection<Debt>(debtsCol());
  const cycles = useCollectionGroup<DebtCycle>("cycles");
  const payments = useCollectionGroup<PaymentRec>("payments");
  const today = new Date();

  const due = debts
    .filter((d) => d.active && d.statementDay && d.dueDay)
    .map((d) => {
      const key = currentCycleKey(d.statementDay!, today);
      const cycle = cycles.find((c) => c.debtId === d.id && c.id === key);
      const { dueDate } = cycleDates(d.statementDay!, d.dueDay!, key);
      const minDue = cycle?.minimumDue ?? d.minimum ?? 0;
      const paid = paidInCycle(payments, d.id, d.statementDay!, key);
      return { d, days: daysUntil(dueDate, today), minDue, paid };
    })
    .filter((x) => x.days >= 0 && x.days <= 7 && x.paid < x.minDue)
    .sort((a, b) => a.days - b.days);

  if (due.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 mb-1">Due soon</p>
      <ul className="flex flex-col gap-1 text-xs text-red-800">
        {due.map(({ d, days, minDue, paid }) => (
          <li key={d.id} className="flex justify-between gap-2">
            <span>{d.name} · due {days === 0 ? "today" : `in ${days}d`}</span>
            <span className="tabular-nums shrink-0">{peso(paid)} of {peso(minDue)} min paid</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
