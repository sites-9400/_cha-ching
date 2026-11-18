import { useRef, useState } from "react";
import { peso } from "../lib/format";
import { toggleLinePaid } from "../lib/repo";
import type { MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";
import { cardColor } from "../lib/cardColors";

export default function LineRow(
  { monthKey, line, readOnly = false, onEdit, spent, budgetTotal }:
  { monthKey: string; line: MonthLine; readOnly?: boolean; onEdit?: () => void;
    spent?: number; budgetTotal?: number }, // budgetTotal: combined pool for grouped budget lines
) {
  const poolTotal = budgetTotal ?? line.amount;
  const { label } = useAccounts();
  const ticked = line.status !== "";
  const [busy, setBusy] = useState(false);

  // Long-press (~450ms) opens the editor; a normal tap toggles PAID.
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const startPress = () => {
    if (!onEdit) return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => { longPressed.current = true; onEdit(); }, 450);
  };
  const clearPress = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const handleClick = () => {
    clearPress();
    if (longPressed.current) { longPressed.current = false; return; } // swallow the click after a long-press
    if (readOnly || busy) return;
    setBusy(true);
    void toggleLinePaid(monthKey, line).finally(() => setBusy(false));
  };

  const hasPool = line.isEnvelope && spent != null && poolTotal > 0;
  const over = hasPool && (spent as number) > poolTotal;

  const helperGroup = line.budgetGroup ? ` (${line.budgetGroup})` : "";
  const stripe = cardColor(line.debtId ?? line.debtSplits?.[0]?.debtId);

  return (
    <li className="py-2.5 flex items-start gap-2">
      <button
        onClick={handleClick}
        onPointerDown={startPress}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
        disabled={readOnly && !onEdit}
        style={{ WebkitTouchCallout: "none" }}
        className="flex-1 flex items-start gap-2 text-left min-w-0 select-none"
        aria-pressed={ticked}
      >
        {stripe && (
          <span aria-hidden="true" className="card-stripe w-1 self-stretch shrink-0 rounded-full" style={{ background: stripe }} />
        )}
        <span
          className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${
            ticked ? "bg-ok border-ok text-manila" : "border-stone-300"
          }`}
        >
          {ticked && (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
        <span className={`flex-1 min-w-0 ${ticked ? "opacity-60" : ""}`}>
          <span className="block text-[16px] leading-5 font-medium text-ink">{line.name}</span>
          <span className="block text-[12px] leading-4 text-ink-2">
            <span className="whitespace-nowrap">{label(line.channel)}</span>
            {line.oneOff && <>{" · "}<span className="whitespace-nowrap">one-off</span></>}
          </span>
          {line.isEnvelope && spent != null && (
            poolTotal === 0 ? (
              <span className="block text-[12px] leading-4 font-normal text-ink-2">
                budget not on hand yet, tick to fund{helperGroup}
              </span>
            ) : over ? (
              <span className="block text-[12px] leading-4 font-semibold text-marker-red tabular-nums">
                Over by {peso((spent as number) - poolTotal)}
                {helperGroup}
              </span>
            ) : (
              <>
                <span className="block text-[12px] leading-4 font-normal text-ink-2 tabular-nums">
                  {peso(Math.max(0, poolTotal - spent!))} left of {peso(poolTotal)}
                  {helperGroup}
                </span>
                <span className="mt-1 block h-1 w-24 rounded-full bg-rule overflow-hidden">
                  <span
                    className="block h-full bg-ink"
                    style={{ width: `${Math.min(100, Math.round((spent! / poolTotal) * 100))}%` }}
                  />
                </span>
              </>
            )
          )}
        </span>
      </button>
      <span className="w-[7.5rem] shrink-0 text-right">
        {over ? (
          <>
            <span className="block font-display text-[17px] leading-5 font-bold tabular-nums text-marker-red">{peso(spent as number)}</span>
            <span className="block font-display text-[13px] leading-4 font-semibold tabular-nums line-through decoration-2 decoration-marker-red text-ink-2">{peso(poolTotal)}</span>
          </>
        ) : (
          <span className="block font-display text-[17px] leading-5 font-bold tabular-nums text-ink">{peso(line.amount)}</span>
        )}
        {ticked && !over && (
          <span className="block text-[12px] leading-4 text-ink-2 lowercase">{line.status}</span>
        )}
      </span>
    </li>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
