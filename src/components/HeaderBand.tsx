import type { ReactNode } from "react";

/** Deep-teal header band for top-level screens: full-bleed background (breaks out
 *  of AppShell's max-w-md), content constrained back to max-w-md. Covers the
 *  safe-area inset itself so color reaches the very top of the screen. */
export default function HeaderBand(
  { title, value, sub, left, right }:
  { title: string; value?: string; sub?: string; left?: ReactNode; right?: ReactNode },
) {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-gradient-to-b from-[#0E5A54] to-[#0A413D] rounded-b-3xl pt-[env(safe-area-inset-top)]">
      <div className="max-w-md mx-auto px-4 pt-4 pb-5 flex items-center gap-2">
        <div className="w-9 shrink-0 flex justify-start">{left}</div>
        <div className="flex-1 min-w-0 text-center">
          {value != null ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100/70">{title}</p>
              <p className="text-4xl font-bold tabular-nums text-white leading-tight">{value}</p>
            </>
          ) : (
            <p className="text-2xl font-bold text-white">{title}</p>
          )}
          {sub && <p className="mt-1 text-xs text-white/60 truncate">{sub}</p>}
        </div>
        <div className="w-9 shrink-0 flex justify-end">{right}</div>
      </div>
    </div>
  );
}
