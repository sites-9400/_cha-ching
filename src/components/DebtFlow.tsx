import { useState } from "react";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { currentMonthKey, monthLabel } from "../lib/clock";
import { monthlyDebtFlow } from "../lib/debtFlow";
import { addMonths, peso } from "../lib/format";
import { debtsCol, expensesCol, statementChargesCol } from "../lib/paths";
import type { Debt, Expense, StatementCharge } from "../lib/types";
import type { PaymentRec } from "./DebtPlan";
import { ChevronLeft, ChevronRight, NAV_BTN } from "./HeaderBand";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortMonth = (key: string): string => SHORT[Number(key.split("-")[1]) - 1];

const arrowProps = {
  viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
};

export default function DebtFlow() {
  const expenses = useCollection<Expense>(expensesCol());
  const debts = useCollection<Debt>(debtsCol());
  const statementCharges = useCollection<StatementCharge>(statementChargesCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const [month, setMonth] = useState(currentMonthKey());

  const months = [-5, -4, -3, -2, -1, 0].map((n) => addMonths(month, n));
  const flow = monthlyDebtFlow({ expenses, statementCharges, debts, payments, months });
  const sel = flow[flow.length - 1];
  const maxVal = Math.max(...flow.map((m) => Math.max(m.added, m.paid, 0)), 0);
  const pct = (v: number): number => (maxVal > 0 ? (Math.max(v, 0) / maxVal) * 100 : 0);
  const grew = sel.net > 0;

  return (
    <section aria-label="Debt this month" className="bg-manila rounded-xl border border-rule shadow-card p-4 mb-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display font-bold text-[20px] leading-6 text-ink">Debt this month</h2>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))} className={NAV_BTN}><ChevronLeft /></button>
          <span className="text-[13px] font-medium text-ink w-[104px] text-center tabular-nums">{monthLabel(month)}</span>
          <button type="button" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))} className={NAV_BTN}><ChevronRight /></button>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="font-display font-bold text-[17px] text-ink">New debt added</span>
          <span className="font-display font-bold text-[17px] tabular-nums text-ink text-right">{peso(sel.added)}</span>
        </div>
        <div className="pl-4 mt-1">
          <div className="flex items-baseline justify-between text-[13px] text-ink">
            <span>Card charges</span>
            <span className="tabular-nums text-right">{peso(sel.cardCharges)}</span>
          </div>
          <div className="flex items-baseline justify-between text-[13px] text-ink mt-1">
            <span>New loans &amp; installments</span>
            <span className="tabular-nums text-right">{peso(sel.newDebts)}</span>
          </div>
          {sel.newDebtItems.map((it) => (
            <div key={it.name} className="flex items-baseline justify-between text-[12px] text-ink-2 pl-3">
              <span className="truncate">{it.name}</span>
              <span className="tabular-nums text-right">{peso(it.amount)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-baseline justify-between mt-3">
          <span className="font-display font-bold text-[17px] text-ink">Paid off</span>
          <span className="font-display font-bold text-[17px] tabular-nums text-ink text-right">{peso(sel.paid)}</span>
        </div>
        <div className="border-t border-rule mt-3 pt-3 flex items-center justify-between">
          <span className="font-display font-bold text-[17px] text-ink">Net change</span>
          <span className={`flex items-center gap-1 font-display font-bold text-[17px] tabular-nums text-right ${grew ? "text-marker-red" : "text-ink"}`}>
            {sel.net !== 0 && (
              <svg {...arrowProps}>
                {grew ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
              </svg>
            )}
            {peso(Math.abs(sel.net))}
            <span className="sr-only">{grew ? " debt grew" : sel.net < 0 ? " debt shrank" : " no change"}</span>
          </span>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-6 gap-1.5" aria-label="Last six months">
        {flow.map((m) => {
          const active = m.monthKey === month;
          return (
            <li key={m.monthKey}>
              <button
                type="button"
                onClick={() => setMonth(m.monthKey)}
                aria-label={`${monthLabel(m.monthKey)}: added ${peso(m.added)}, paid ${peso(m.paid)}`}
                aria-pressed={active}
                className={`w-full rounded-lg px-1 py-1.5 border ${active ? "border-ink" : "border-transparent"}`}
              >
                <span className="block h-1.5 rounded-full bg-rule overflow-hidden">
                  <span className="block h-full bg-marker-red" style={{ width: `${pct(m.added)}%` }} />
                </span>
                <span className="block h-1.5 rounded-full bg-rule overflow-hidden mt-1">
                  <span className="block h-full bg-ink" style={{ width: `${pct(m.paid)}%` }} />
                </span>
                <span className={`block mt-1 text-[12px] text-center ${active ? "font-semibold text-ink" : "text-ink-2"}`}>{shortMonth(m.monthKey)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex items-center gap-3 text-[12px] text-ink-2">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-marker-red" />Added</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-ink" />Paid</span>
      </div>
      <p className="mt-2 text-[12px] text-ink-2">Card charges come from logged card expenses and imported statements.</p>
    </section>
  );
}
