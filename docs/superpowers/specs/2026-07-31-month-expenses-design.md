# Cha-Ching — Browsable Month Expenses — Design Spec

**Date:** 2026-07-31
**Owner:** Eve (gamaliel)
**Status:** Approved in-session

## Problem

There is no way to browse logged expenses. Every existing surface either caps
the list or demands a query first:

| Site | Behaviour | Why it doesn't cover browsing |
|---|---|---|
| `QuickAdd.tsx:55` | `.slice(0, 8)` on the recent list | Hard cap at 8. This is the one the user hit. |
| `ExpenseSearch.tsx:28` | `q === "" ? [] : …` | Renders nothing until you type. Caps at 50. |
| `CategoryBars.tsx:26` | per-category, current month | Aggregate, not a browsable list |
| `SpendingCalendar.tsx:43` | per-day, current month | Aggregate, not a browsable list |

The data is not the constraint — `ThisMonth.tsx:32` already subscribes the full
`expenses` collection, and `ExpenseSearch` notes the same. The gap is purely a
missing view.

## Design

A collapsible **Expenses** section at the bottom of the month view, listing
every expense logged in the viewed month, newest first, with no cap. Month
selection is already handled by the existing ‹ › nav in `HeaderBand`, so
browsing back through history needs no new navigation.

### Pure selector

New in `src/lib/selectors.ts`:

```ts
/** Expenses logged in `monthKey` ("YYYY-MM"), newest first, with their total.
 *  Pure. */
export function monthExpenses(
  expenses: readonly Expense[],
  monthKey: string,
): { items: Expense[]; total: number }
```

Filters on `e.date.slice(0, 7) === monthKey`, sorts by
`b.date.localeCompare(a.date)` (the same comparator `QuickAdd.tsx:55` and
`ExpenseSearch.tsx:35` already use), and sums `amount`. Returning the total
alongside the list keeps the header cheap — the caller never re-walks the array.

### Extracted row component

`ExpenseSearch.tsx:48-62` holds the expense-row markup — `ChannelIcon`, the
`MM-DD · category · note` line, the account label, and the peso amount. The new
section needs it identically. Extract it verbatim to
`src/components/ExpenseRow.tsx`:

```ts
export default function ExpenseRow({ expense, onClick }: {
  expense: Expense;
  onClick: () => void;
})
```

It calls `useAccounts()` internally for `chip` and `label` rather than taking
them as props, so both call sites shrink. `ExpenseSearch` is refactored to use
it in the same change — the point of extracting is that one row definition
exists, not two that drift.

### Section component

New `src/components/MonthExpenses.tsx`, props `{ expenses, monthKey }`.

It subscribes what `EditExpenseDialog` needs itself — categories, that month's
lines via `activeLines`, and active debts sorted by `payoffOrder` — mirroring
`ExpenseSearch.tsx:21-25`. One deliberate difference: `ExpenseSearch` reads
`monthLines(currentMonthKey())`, but this component reads `monthLines(monthKey)`
so editing an expense in a past month resolves envelope lines against *that*
month rather than today's.

Behaviour:

- **Header always rendered**: `Expenses · {count} · {peso(total)}`. Useful while
  collapsed, and free because the selector already computed both.
- **Collapsed by default**, toggled by tapping the header. The month view is
  already long, and closed cutoffs collapse by default too
  (`ThisMonth.tsx:51-58`), so this matches the established behaviour.
- **No cap** when expanded. Every expense for the month renders. This is the
  fix.
- **Tap a row** → the existing `EditExpenseDialog`, unchanged.
- **Empty month** → `No expenses logged for {monthLabel(monthKey)}.`

Collapse state is component-local `useState`. It is deliberately not persisted
to `localStorage` — see Out of scope.

### Placement

In `ThisMonth.tsx`, after the two `CutoffSection` blocks (`:142-170`) and before
the dialog block (`:172`):

```tsx
<MonthExpenses expenses={expenses} monthKey={viewedKey} />
```

Rendered **outside** the `{editable && …}` guard at `:116`. Past months are the
main thing worth browsing, and that guard would hide the section on exactly
those. Viewing and editing an expense is not a month-line mutation, so the
editable gate does not apply.

## Error handling

- **Projected months** have no saved expenses, so the selector returns an empty
  list and the empty state renders. No special-casing.
- **An expense whose envelope line no longer exists** (deleted line, restarted
  month): already handled by `EditExpenseDialog` and `PaidFromPicker`, which
  fall back to Unplanned for an unresolvable source. Unchanged by this work.
- **An expense whose `date` is malformed** would fail the `slice(0, 7)` equality
  and be omitted rather than crash. Dates are written by `localIso()` and the
  date input, so this is a defensive property, not an expected path.
- **Deleting an expense from the dialog** while the section is open: the
  `useCollection` subscription is live, so the row disappears and the header
  count and total recompute on the next render.

## Testing

New tests in `src/lib/selectors.test.ts` for `monthExpenses`:

1. Returns only expenses whose `date` falls in the given month
2. Excludes the adjacent month (`2026-06`, `2026-08`) and the same month in
   another year (`2025-07`) — boundary correctness
3. Sorts newest first
4. `total` equals the sum of the filtered items, not of all input
5. An empty month returns `{ items: [], total: 0 }`

`ExpenseRow` and `MonthExpenses` are presentational and covered by
`npm run typecheck` plus `npm run build`; the repo has no DOM test environment
(all 204 existing tests are pure `src/lib/` functions), so no component test is
written rather than a hollow one.

Manual walkthrough before merge:

- Current month: expand, confirm every logged expense appears with no cap, and
  the header count and total match the Stats month total
- Navigate back a month: confirm the section shows *that* month's expenses
- Tap a row, edit the amount, confirm the row and the header total update
- A month with no expenses: confirm the empty state
- Confirm `ExpenseSearch` still renders identically after the row extraction

## Out of scope

- Persisting the collapsed/expanded state across sessions.
- Filtering or sorting within the section (by category, account, amount).
- An all-time history view spanning months — the ‹ › nav covers this.
- Raising or removing `QuickAdd`'s `.slice(0, 8)`. That list is a compact
  "did that save?" affordance on the entry screen and stays as it is.
- Raising `ExpenseSearch`'s `MAX_RESULTS = 50`; it already reports
  `showing 50 of N`.
