# Cha-Ching — Budget-App-Inspired Features & Renames — Design Spec

**Date:** 2026-07-18
**Owner:** Eve (gamaliel)
**Status:** Approved in-session (renames + all three features chosen)

## Scope

Four independent, small pieces inspired by the Budget App (App Store id
1525179720). Display renames only — **no code identifiers or Firestore
field/collection names change**, so no data migration.

## 1. Display renames

| Where | Old | New |
|---|---|---|
| Settings row + editor headings | Template lines | Recurring |
| Settings row + editor headings | Events | Planned one-offs |
| Envelope toggle (TemplateEditor Form, EditLineDialog) + helper copy | Envelope | Budget |
| Quick Add screen title | Quick Add | Expenses |

The tab bar's center button already says "Add" — unchanged. "Paid from" chips
keep the line's own name. Internal names (`isEnvelope`, `template-lines`,
`events`, components) untouched.

## 2. Spending calendar (Dashboard)

- New `SpendingCalendar` section at the top of Dashboard: a 7-column month
  grid (Mon-start), each day cell showing the day number and, when nonzero,
  that day's total Quick Add spending (compact, e.g. "1.2k").
- Month nav arrows (defaults to current month). Days with spending get a
  filled background; intensity is flat (one shade) — no heatmap for v1.
- Tapping a day expands a list under the grid: that day's expenses (category,
  budget/envelope tag, note, amount). Tap an expense → the existing
  `EditExpenseDialog`.
- Pure helper in `stats.ts`: `dailyTotals(expenses, monthKey): Map<number, number>`
  (day-of-month → total), unit-tested.

## 3. Category budgets (monthly)

- `Category` gains `budget?: number` (monthly cap; unset = no cap).
  CategoriesEditor gains a per-category budget input (blank clears it —
  strip undefined before Firestore writes).
- Dashboard's "Spending by category" bars become budget-aware: when a
  category has a budget, the bar is scaled `spent/budget` (red segment beyond
  100%) and labeled "₱spent of ₱budget"; without a budget, current behavior.
- No interaction with cutoff free-cash math — category budgets are
  informational (the envelope/Budget lines remain the money-math mechanism).

## 4. Subscriptions view

- New collection `subscriptions/{id} { name, amount, channel?, note? }` — an
  itemized registry of individual services (Netflix, iCloud, …) that today
  hide inside bundled "Subscriptions (…)" recurring lines.
- New Settings section "Subscriptions": CRUD list sorted by amount desc, with
  a monthly total headline. Informational only — does not create lines or
  affect math (the bundled recurring lines still carry the money).
- Path helper `subscriptionsCol()`, repo add/update/delete.

## Error handling

- Calendar with no expenses: grid renders, no filled days, no list.
- Category budget of 0 treated as unset (no divide-by-zero).
- Subscriptions with no channel show no chip.

## Testing

- `stats.ts`: `dailyTotals` (month filtering, summing, day parsing).
- Category budget bar math is presentation-only; verified by typecheck +
  existing tests + manual walkthrough.
- Everything else: `npm run typecheck`, `npx vitest run`, `npm run build`,
  manual on-phone pass.

## Out of scope

- Heatmap shading, week-start setting, calendar on This Month.
- Category budgets affecting free cash or the debt plan.
- Auto-detecting subscriptions from lines; linking registry entries to lines.
- Renaming Firestore fields/collections or code identifiers.
