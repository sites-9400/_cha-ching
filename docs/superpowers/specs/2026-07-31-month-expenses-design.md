# Cha-Ching — Browsable Month Expenses — Design Spec

**Date:** 2026-07-31
**Owner:** Eve (gamaliel)
**Status:** Approved in-session

> Supersedes the first draft of this file, which placed the list in
> `ThisMonth.tsx`. It belongs in the Spending calendar card on Stats, which
> already owns a month and already renders an expense list.

## Problem

There is no way to browse logged expenses. Every existing surface either caps
the list or demands an interaction first:

| Site | Behaviour | Why it doesn't cover browsing |
|---|---|---|
| `QuickAdd.tsx:55` | `.slice(0, 8)` on the recent list | Hard cap at 8. This is the one the user hit. |
| `ExpenseSearch.tsx:28` | `q === "" ? [] : …` | Renders nothing until you type. Caps at 50. |
| `SpendingCalendar.tsx:83` | `openDay !== null && …` | Renders nothing until you tap a day, then shows that day only |
| `CategoryBars.tsx:26` | per-category, current month | Aggregate, not a browsable list |

The data is not the constraint — `Dashboard.tsx:27` already subscribes the full
`expenses` collection and passes it to every child. The gap is that no surface
lists a whole month.

## Design

`SpendingCalendar` already owns a `monthKey` with ‹ › navigation (`:27`,
`:46-49`, `:54-58`) and already renders an expense list. The change is to what
it renders when no day is selected:

**`openDay === null` currently renders nothing. It renders the whole month
instead.** Selecting a day narrows to that day, exactly as today. Deselecting
returns to the month.

No new component, no new navigation, no change to `ThisMonth`.

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
`b.date.localeCompare(a.date)` — the comparator `QuickAdd.tsx:55`,
`ExpenseSearch.tsx:35` and `SpendingCalendar.tsx:44` already share — and sums
`amount`. Returning the total alongside the list keeps the header cheap.

### Extracted row component

The expense-row markup exists in **two** places today —
`ExpenseSearch.tsx:48-62` and `SpendingCalendar.tsx:86-97` — and this work would
otherwise reuse it a third time. They differ in exactly one way: the search row
prefixes `MM-DD`, the day row does not, because the day is already known.

Extract to `src/components/ExpenseRow.tsx`:

```ts
export default function ExpenseRow({ expense, onClick, showDate = false }: {
  expense: Expense;
  onClick: () => void;
  showDate?: boolean;
})
```

It calls `useAccounts()` internally for `chip` and `label` rather than taking
them as props. `ExpenseSearch` (`showDate`) and `SpendingCalendar`'s day list
(no `showDate`) are both refactored onto it in the same change — the point of
extracting is that one row definition exists, not three.

### SpendingCalendar changes

Replace the `dayExpenses` derivation (`:42-44`) with:

```ts
const month = monthExpenses(expenses, monthKey);
const dayItems = openDay === null
  ? []
  : month.items.filter((e) => Number(e.date.slice(8, 10)) === openDay);
const shown = openDay === null ? month.items : dayItems;
const shownTotal = openDay === null
  ? month.total
  : dayItems.reduce((s, e) => s + e.amount, 0);
```

Deriving the day list from `month.items` removes the component's duplicate
month-filter-and-sort — it inherits both from the selector.

Replace the `openDay !== null &&` gate (`:83`) with an always-rendered block:

- **Header**, `text-[11px]` row: left is `All of {monthLabel(monthKey)}` when no
  day is selected, or `{monthLabel(monthKey)} · {openDay}` when one is; right is
  `{shown.length} · {peso(shownTotal)}`.
- **List**: `shown.map(...)` through `ExpenseRow`, with `showDate` set only when
  `openDay === null`. **Uncapped** — every expense in the month renders.
- **Empty**: `No expenses in {monthLabel(monthKey)}.` when the month is empty,
  or the existing `No expenses that day.` when a day is selected.

Tapping a row opens the existing `EditExpenseDialog`, unchanged.

### Decisions recorded

- **Uncapped, always shown.** Chosen over a ~15-item cap with "show all" and
  over a fixed-height scroll box. The Stats page gets longer on a heavy month;
  that is accepted.
- **The day view keeps its label in the shared header** rather than gaining a
  separate one. The mockup showed `July 27`; the spec uses
  `{monthLabel(monthKey)} · {openDay}` → `July 2026 · 27`, to avoid introducing
  a day-formatting helper for one string.

## Error handling

- **Month with no expenses** → empty state; the selector returns
  `{ items: [], total: 0 }`.
- **Changing month** already calls `setOpenDay(null)` (`:48`), so the list falls
  back to the full month on navigation. No extra handling.
- **An expense whose envelope line no longer exists** (deleted line, restarted
  month): already handled by `EditExpenseDialog` and `PaidFromPicker`, which
  fall back to Unplanned. Unchanged by this work.
- **A malformed `date`** fails the `slice(0, 7)` equality and is omitted rather
  than crashing. Dates are written by `localIso()` and the date input, so this
  is a defensive property, not an expected path.
- **Editing or deleting from the dialog** while the list is open: the
  `useCollection` subscription is live, so the row and the header count and
  total recompute on the next render.

## Testing

New tests in `src/lib/selectors.test.ts` for `monthExpenses`:

1. Returns only expenses whose `date` falls in the given month
2. Excludes the adjacent months (`2026-06`, `2026-08`) and the same month in
   another year (`2025-07`) — boundary correctness
3. Sorts newest first
4. `total` equals the sum of the filtered items, not of all input
5. An empty month returns `{ items: [], total: 0 }`

`ExpenseRow` and the `SpendingCalendar` changes are presentational and covered
by `npm run typecheck` and `npm run build`; the repo has no DOM test environment
(all 204 existing tests are pure `src/lib/` functions), so no component test is
written rather than a hollow one.

Manual walkthrough before merge:

- Stats → Spending calendar with no day selected: every July expense listed,
  header count and total matching the month
- Tap a day: list narrows to that day, date prefix disappears, header switches
- Tap the same day again: full month returns
- ‹ › to June: list shows June, no day selected
- Tap a row, change the amount, confirm the row and header total update
- A month with no expenses: empty state
- `ExpenseSearch` still renders identically after the row extraction

## Out of scope

- Filtering or sorting within the list (by category, account, amount).
- Collapsing the list or persisting a collapsed state.
- Any change to `ThisMonth`.
- Raising or removing `QuickAdd`'s `.slice(0, 8)`. That list is a compact
  "did that save?" affordance on the entry screen and stays as it is.
- Raising `ExpenseSearch`'s `MAX_RESULTS = 50`; it already reports
  `showing 50 of N`.
