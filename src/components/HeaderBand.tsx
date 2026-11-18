import type { ReactNode } from "react";

/** Flat kraft header band for top-level screens: full-bleed background (breaks out
 *  of AppShell's max-w-md), content constrained back to max-w-md. Covers the
 *  safe-area inset itself so color reaches the very top of the screen.
 *  Left-aligned: nav row (left / right buttons with `label` between), then the
 *  hero value, then `sub`. */
export default function HeaderBand(
  { title, value, sub, left, right, label, children }:
  { title: string; value?: string; sub?: ReactNode; left?: ReactNode; right?: ReactNode; label?: string; children?: ReactNode },
) {
  const hasNav = left != null || right != null;
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-kraft border-b border-kraft-deep text-ink pt-[env(safe-area-inset-top)]">
      <div className="max-w-md mx-auto px-4 pt-3 pb-4 text-left">
        {hasNav && (
          <div className="flex items-center justify-between gap-2">
            <div className="w-10 shrink-0 flex justify-start">{left}</div>
            {label && <p className="flex-1 min-w-0 text-center truncate font-display font-semibold text-[18px] leading-6 text-ink">{label}</p>}
            <div className="w-10 shrink-0 flex justify-end">{right}</div>
          </div>
        )}
        {value != null ? (
          <>
            <p className="mt-2 text-[15px] leading-5 font-medium text-ink">{title}</p>
            <p className="font-display font-extrabold text-[44px] leading-none text-ink tabular-nums"><HeroValue value={value} /></p>
          </>
        ) : (
          <h1 className="mt-2 font-display font-bold text-[28px] leading-8 text-ink">{title}</h1>
        )}
        {sub != null && sub !== "" && <p className="mt-1.5 text-[13px] leading-[18px] text-ink/80">{sub}</p>}
        {children}
      </div>
    </div>
  );
}

/** Splits a leading "₱" (optionally behind a minus sign) so the peso sign can sit
 *  small and top-aligned like a stall price; the numerals are untouched. */
function HeroValue({ value }: { value: string }) {
  const m = /^([-\u2212]?)(\u20B1)(.*)$/.exec(value);
  if (!m) return <>{value}</>;
  return (
    <>
      {m[1]}
      <span className="inline-block align-top text-[0.6em] leading-none mr-[0.06em] mt-[0.08em]">{m[2]}</span>
      {m[3]}
    </>
  );
}

const chevron = {
  viewBox: "0 0 24 24", width: 20, height: 20, fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
};

export const NAV_BTN = "h-10 w-10 flex items-center justify-center rounded-lg border border-ink/30 bg-transparent text-ink active:bg-kraft-deep/30";
export const ChevronLeft = () => (<svg {...chevron}><path d="M15 5l-7 7 7 7" /></svg>);
export const ChevronRight = () => (<svg {...chevron}><path d="M9 5l7 7-7 7" /></svg>);
