import { useRef } from "react";
import { peso } from "../lib/format";
import { toggleLinePaid } from "../lib/repo";
import type { MonthLine } from "../lib/types";
import { useAccounts } from "./AccountsProvider";

export default function LineRow(
  { monthKey, line, readOnly = false, onDelete, onEdit, spent }:
  { monthKey: string; line: MonthLine; readOnly?: boolean; onDelete?: () => void; onEdit?: () => void; spent?: number },
) {
  const { chip, label } = useAccounts();
  const ticked = line.status !== "";

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
    if (!readOnly) void toggleLinePaid(monthKey, line);
  };

  return (
    <li className="py-2 flex items-center justify-between gap-2">
      <button
        onClick={handleClick}
        onPointerDown={startPress}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
        disabled={readOnly && !onEdit}
        style={{ WebkitTouchCallout: "none" }}
        className={`flex-1 flex items-center gap-2 text-left min-w-0 select-none ${ticked ? "opacity-50" : ""}`}
        aria-pressed={ticked}
      >
        <span
          className={`h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] ${
            ticked ? "bg-emerald-600 border-emerald-600 text-white" : "border-stone-300"
          }`}
        >
          {ticked ? "✓" : ""}
        </span>
        <span className="text-sm min-w-0">
          {line.name}
          {line.oneOff && <span className="ml-1 text-[10px] text-amber-600">•one-off</span>}
          {line.isEnvelope && spent != null && (
            <>
              <span className="block text-[10px] text-stone-400 tabular-nums">
                {peso(Math.max(0, line.amount - spent))} left of {peso(line.amount)}
              </span>
              <span className="mt-0.5 block h-1 w-24 rounded-full bg-stone-100 overflow-hidden">
                <span
                  className={`block h-full ${spent > line.amount ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${line.amount > 0 ? Math.min(100, Math.round((spent / line.amount) * 100)) : 100}%` }}
                />
              </span>
            </>
          )}
        </span>
      </button>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums">{peso(line.amount)}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${chip(line.channel)}`}>
          {label(line.channel)}
        </span>
        {onDelete && <button onClick={onDelete} className="text-stone-300 text-xs pl-1">✕</button>}
      </span>
    </li>
  );
}
