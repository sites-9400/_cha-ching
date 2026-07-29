# Audit batch 6 — Features: search, comparison, derived projection

**Date:** 2026-07-29 · **Status:** Approved (audit remediation, Eve: "go do by batch")

## 1. Derived debt-free projection (replaces MONTHLY_PAYDOWN constant)

`Debts.tsx` header projects "clear by {month}" from a hardcoded
`MONTHLY_PAYDOWN = 90164` whose own comment says "until history exists".
History exists.

New pure fn in `src/lib/stats.ts` (+ tests in stats.test.ts):

```ts
/** Average monthly paydown of tracked (non-BNPL) debt over the most recent
 *  `monthsBack` distinct payment months, excluding the current (partial)
 *  month. Falls back to `fallback` when there is no completed history. */
export function averagePaydown(
  payments: readonly { debtId: string; monthKey: string; amount: number }[],
  trackedDebtIds: ReadonlySet<string>,
  currentMonthKey: string,
  monthsBack = 3,
  fallback = 0,
): number {
  const byMonth = new Map<string, number>();
  for (const p of payments) {
    if (!trackedDebtIds.has(p.debtId) || p.monthKey >= currentMonthKey) continue;
    byMonth.set(p.monthKey, (byMonth.get(p.monthKey) ?? 0) + p.amount);
  }
  const months = [...byMonth.keys()].sort().slice(-monthsBack);
  if (months.length === 0) return fallback;
  return months.reduce((s, m) => s + (byMonth.get(m) ?? 0), 0) / months.length;
}
```

`Debts.tsx`: keep the constant as the fallback only —

```ts
  const trackedIds = new Set(debts.filter((d) => d.active && !d.isBNPL).map((d) => d.id));
  const monthlyPaydown = averagePaydown(payments, trackedIds, thisMonth, 3, MONTHLY_PAYDOWN);
  const freeMonth = projectDebtFreeMonth(debts, monthlyPaydown, thisMonth);
```

Rename the constant's comment to say it is now only the no-history fallback.
Header sub also shows the basis: `` `interest-bearing clear by ${monthLabel(freeMonth)} · ~${peso(Math.round(monthlyPaydown))}/mo` ``.

Tests: averages only tracked debts' months; excludes current month; takes
the latest 3 distinct months; empty history → fallback.

## 2. Month-over-month category deltas

`CategoryBars.tsx`: compute `const prevTotals = new Map(categoryTotals(expenses, addMonths(monthKey, -1)).map((t) => [t.category, t.total]));`
(`addMonths` from `../../lib/format`). In each category row's right label,
append a small delta marker vs last month when the category had spend then:

```tsx
{prev != null && prev > 0 && (
  <span className={`ml-1.5 text-[10px] ${t.total > prev ? "text-red-600" : "text-emerald-600"}`}>
    {t.total > prev ? "↑" : "↓"}{Math.abs(Math.round(((t.total - prev) / prev) * 100))}%
  </span>
)}
```

(No layout change otherwise; categories with no prior spend show nothing.)

## 3. Expense search / full history

New `src/components/dashboard/ExpenseSearch.tsx`, rendered in `Dashboard.tsx`
below CategoryBars. Self-contained like SpendingCalendar (loads its own
categories/lines/debts for the edit dialog):

- A search input styled like the app's inputs
  (placeholder "Search expenses — note, category, account…").
- Results only when the query is non-empty: case-insensitive substring match
  over `note`, `category`, `channel`, and the peso amount as text; ALL
  months (the full collection is already subscribed client-side). Sort date
  desc, cap at 50 rows with a "showing 50 of N" footer when more.
- Row: date (`MM-DD`), category, note (truncated), channel label, amount —
  reuse the Recent-list row styling from QuickAdd. Tapping opens
  `EditExpenseDialog` (pass categories, current-month `activeLines`, active
  debts — mirror SpendingCalendar's usage of the dialog and its prop shapes).
- Month totals aren't needed here — this is retrieval, not analytics.

## 4. savingsFloor honest fallback

`Dashboard.tsx`: `floor={meta?.savingsFloor ?? 100000}` → `?? 0`. A missing
meta field must not masquerade as a six-figure floor.

## Out of scope

- Dashboard-wide month browsing (calendar already navigates months).
- Web-push due-date notifications (bigger project; DueSoonStrip now on
  Quick Add covers the daily path).
