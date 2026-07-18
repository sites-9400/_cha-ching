# Budget-App Features Implementation Plan

> Executed by a Sonnet subagent (user-requested for cost); Fable reviews, verifies, commits.

**Spec:** `docs/superpowers/specs/2026-07-18-budget-app-features-design.md`
**Repo:** /Users/gamaliel/Library/CloudStorage/Dropbox/Personal Workspace/cha-ching (branch `main`; no git commands — leave changes in working tree)
**Constraints:** never write `undefined` to Firestore (omit keys / strip). 2-space indent, existing Tailwind patterns, `peso()` for money. Tests via `npx vitest run`, types via `npm run typecheck`.

### Task 1: Display renames (labels only — no identifiers, no Firestore names)

- `src/components/Settings.tsx` ROWS: label "Template lines" → "Recurring"; label "Events" → "Planned one-offs". Ids/sections unchanged.
- `src/components/settings/TemplateEditor.tsx`: h2 "Template lines" → "Recurring"; toggle label "Envelope" → "Budget"; its helper text → "Quick Add can draw spending from this budget line instead of free cash."
- `src/components/EditLineDialog.tsx`: label "Envelope" → "Budget".
- `src/components/settings/EventsEditor.tsx`: h2 "Events" → "Planned one-offs".
- `src/components/QuickAdd.tsx`: h1 "Quick Add" → "Expenses".

### Task 2: `dailyTotals` + SpendingCalendar (TDD)

- Add to `src/lib/stats.ts`:
  `dailyTotals(expenses: readonly { amount: number; date: string }[], monthKey: string): Map<number, number>` — day-of-month (Number(date.slice(8,10))) → summed amount, only expenses in monthKey.
- Tests first in `src/lib/stats.test.ts` (match file's existing style): sums same-day expenses; filters other months; empty input → empty map. Run to see fail, then implement, then pass.
- New `src/components/dashboard/SpendingCalendar.tsx`:
  - Props: `{ expenses: DashExpense[] }` where DashExpense is extended (see Task 2b) — or accept its own type `{ id, amount, category, date, note?, envelopeLineId?, channel }`.
  - Internal state: `monthKey` (default `currentMonthKey()`), nav arrows ‹ › (same styling as BackupsEditor's month nav), `openDay: number | null`, `editing` expense for dialog.
  - Grid: Monday-start 7-column CSS grid. Compute first weekday: `new Date(y, m-1, 1).getDay()` → offset `(getDay()+6)%7`; days in month `new Date(y, m, 0).getDate()`. Leading blanks as empty cells.
  - Day cell: day number (text-[11px]); if dailyTotals has the day, filled `bg-emerald-100 text-emerald-800 font-semibold` rounded cell plus compact total under the number (`₱` omitted; format ≥1000 as `${(n/1000).toFixed(1)}k` trimming trailing `.0`, else whole number). Selected day gets ring.
  - Tap day → list under grid of that day's expenses (category, envelope line name if any is NOT available here — show note + amount + channel chip via useAccounts), each row tappable → `EditExpenseDialog` (import from ../EditExpenseDialog; needs `categories` and `lines` props — subscribe inside SpendingCalendar via useCollection(categoriesCol()) and useCollection(monthLines(monthKey))).
  - Section wrapper: `bg-white rounded-xl shadow p-4` with h2 "Spending calendar" (matches other dashboard sections).
- `src/components/Dashboard.tsx`: read it first; render `<SpendingCalendar …/>` as the FIRST section, passing the expenses collection it already subscribes to (extend its expense type with `envelopeLineId?`/`channel` if needed).

### Task 3: Category budgets

- `src/lib/types.ts`: `Category` gains `budget?: number`.
- `src/components/settings/CategoriesEditor.tsx`: read first; add per-category budget number input (blank = unset). On save, omit/strip undefined (follow DebtsEditor's `clean` pattern). Keep existing add/rename/reorder behavior intact.
- `src/components/dashboard/CategoryBars.tsx`: accept `categories: Category[]` prop (Dashboard already can subscribe via categoriesCol; add if missing). For a category with `budget > 0`: bar width = `min(100, spent/budget*100)`; bar color emerald, but red (`bg-red-500`) when spent > budget; right label becomes `{peso(total)} of {peso(budget)}`. Without budget: unchanged (scaled to max, plain peso label).

### Task 4: Subscriptions registry

- `src/lib/paths.ts`: `export const subscriptionsCol = (): string => col("subscriptions");` + assertion in `src/lib/paths.test.ts` (`households/main/subscriptions`).
- `src/lib/types.ts`: `export interface Subscription { id: string; name: string; amount: number; channel?: Channel; note?: string }`.
- `src/lib/repo.ts`: `addSubscription(s: Omit<Subscription,"id">)`, `updateSubscription(id, patch)`, `deleteSubscription(id)` — mirror event repo fns; strip undefined channel/note (omit keys).
- New `src/components/settings/SubscriptionsEditor.tsx`: mirror EventsEditor's structure/styling. List sorted amount desc, each row: name · channel chip (if set) · amount; headline under h2: "₱{total}/month across {n} subscriptions". Form: name, amount, channel (optional select with "—"), note. Delete with ConfirmDialog.
- `src/components/Settings.tsx`: add Section "subscriptions", ROWS entry { id: "subscriptions", label: "Subscriptions" } after "funds"; Editor case.

### Verify (must pass before finishing)

`npm run typecheck` && `npx vitest run` && `npm run build`. Return files changed + verification output tails.
