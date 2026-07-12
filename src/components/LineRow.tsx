import { channelChipSafe } from "../lib/channels";
import { peso } from "../lib/format";
import { setLineStatus } from "../lib/repo";
import type { MonthLine } from "../lib/types";

export default function LineRow({ monthKey, line }: { monthKey: string; line: MonthLine }) {
  const ticked = line.status !== "";
  const nextStatus = ticked ? "" : "PAID";

  return (
    <li className="py-2 flex items-center justify-between gap-2">
      <button
        onClick={() => void setLineStatus(monthKey, line.id, nextStatus)}
        className={`flex-1 flex items-center gap-2 text-left ${ticked ? "opacity-50" : ""}`}
        aria-pressed={ticked}
      >
        <span
          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center text-[11px] ${
            ticked ? "bg-emerald-600 border-emerald-600 text-white" : "border-stone-300"
          }`}
        >
          {ticked ? "✓" : ""}
        </span>
        <span className="text-sm">
          {line.name}
          {line.oneOff && <span className="ml-1 text-[10px] text-amber-600">•one-off</span>}
        </span>
      </button>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums">{peso(line.amount)}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${channelChipSafe(line.channel)}`}>
          {line.channel}
        </span>
      </span>
    </li>
  );
}
