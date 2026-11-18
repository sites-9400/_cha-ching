import { LINE_GROUPS } from "../lib/lineGroups";
import type { LineGroup } from "../lib/types";

/** Chip picker for a line's spending group. Presentational. */
export default function GroupChips(
  { value, onChange, disabled = false }:
  { value: LineGroup; onChange: (g: LineGroup) => void; disabled?: boolean },
) {
  return (
    <div role="radiogroup" aria-label="Group" className="flex flex-wrap items-center gap-1.5 min-h-[44px]">
      {LINE_GROUPS.map((g) => {
        const on = g.key === value;
        return (
          <button
            key={g.key} type="button" role="radio" aria-checked={on} disabled={disabled}
            onClick={() => onChange(g.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] leading-4 font-semibold disabled:opacity-50 ${
              on ? "bg-ink text-manila" : "bg-board text-stone-600 border border-rule"
            }`}
          >{g.label}</button>
        );
      })}
    </div>
  );
}
