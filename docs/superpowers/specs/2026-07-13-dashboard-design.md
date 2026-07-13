# Cha-Ching — Dashboard / Stats Screen (Design Spec)

**Date:** 2026-07-13
**Owner:** Eve (gamaliel)
**Status:** Approved (design questions resolved)
**Parent spec:** docs/superpowers/specs/2026-07-13-cha-ching-design.md
**Milestone:** M4 (Dashboard; follows M3a–M3d)

## What it is

The Stats tab is a placeholder. This builds the Dashboard: four read-mostly panels
that turn the data the app already stores into a picture — debt draining over time,
where this month's discretionary money went, savings vs the ₱100k floor, and each
sinking fund's balance + next release.

## Panels (form chosen before color, per dataviz method)

1. **Debt curve** — change-over-time → a single-series **line** of total
   interest-bearing (non-BNPL) debt at the end of each month that had payments,
   derived from payment history. Emerald line, recessive axes, endpoint labels.
2. **Spending by category (this month)** — magnitude-by-identity → **horizontal
   bars**, one per category, of this month's Quick Add (unplanned) expenses, sorted
   descending. Single emerald hue. Tapping a category reveals its individual
   expenses **with their notes** (the "unplanned with notes" detail). Planned
   spending is intentionally excluded — it isn't categorized in the data model and
   already lives on This Month.
3. **Savings vs floor** — one value against a threshold → a **meter** (bar) of
   `meta.savingsBalance` with a red line at `meta.savingsFloor` (₱100k). Fill turns
   red/"below floor" status when under. Inline edit writes `updateMeta`.
4. **Sinking funds** — small magnitudes + a date → **stat tiles**, one per fund:
   balance and next release month.

Colors: every panel is single-series, so the app's existing emerald (data) / red
(floor + danger) / stone (axes, grid, ink) tokens suffice — no categorical palette,
no validator run required. Text uses ink tokens, never the mark color.

## Pure logic (in `src/lib/stats.ts`, TDD)

- **`debtCurve(currentTotal, payments)` → `{ month, balance }[]`** — ascending by
  month. `balance` at end of month *m* = `currentTotal + Σ(payment.amount where
  payment.monthKey > m)`. Consumes payments already filtered to tracked (non-BNPL)
  debts. Reconstructs history from live balance + payments; pure.
- **`categoryTotals(expenses, monthKey)` → `{ category, total }[]`** — this month's
  expenses summed per category, sorted total desc; pure.
- **`nextRelease(releaseMonths, fromMonthIndex)` → `number | null`** — the next
  release month (1–12) on/after `fromMonthIndex`, wrapping to the earliest if none
  remain this year; `null` if the fund never releases. Pure.

## Components

- `Dashboard.tsx` — subscribes debts (`debtsCol`), payments
  (`useCollectionGroup("payments")`), expenses (`expensesCol`), funds (`fundsCol`),
  and the meta doc (`metaDoc`); lays out the four panels.
- `dashboard/DebtCurveChart.tsx`, `dashboard/CategoryBars.tsx`,
  `dashboard/SavingsMeter.tsx`, `dashboard/FundTiles.tsx` — focused inline-SVG /
  markup components. Charts get native value tooltips + direct labels (basic
  interaction appropriate to a single-user mobile PWA).
- `AppShell.tsx` — render `<Dashboard/>` for the `dashboard` tab (replaces the
  `Placeholder`).

## Data & error handling

- No schema change. `updateMeta` (M3b) already exists for the savings edit; the meta
  read uses `useDoc(metaDoc())` → `Meta`.
- Payments are joined to debts to keep only non-BNPL ones for the curve; a payment
  whose debt was deleted is skipped (no crash).
- Empty states: no payments → "Log a payment to see the curve"; no expenses → "No
  spending logged this month"; no funds → hide the funds panel.
- Savings edit rejects blank/negative; the floor line renders even when balance is 0.

## Testing & verification

- **Vitest** for `debtCurve` (end-of-month reconstruction, single & multi-month,
  payments-after ordering), `categoryTotals` (grouping, sort, month filter),
  `nextRelease` (next on/after, wrap, none).
- **Manual/browser:** curve declines to the live total; category bars match Quick
  Add; tapping a category lists its notes; savings meter shows floor line and flips
  below floor; editing savings persists; fund tiles show next release.

## Build order

1. `stats.ts` pure functions + tests.
2. `SavingsMeter` + `FundTiles` (no chart geometry) + Dashboard shell wired into AppShell.
3. `CategoryBars` (+ note drill-down).
4. `DebtCurveChart` (inline-SVG line).
5. Live verification + deploy.
