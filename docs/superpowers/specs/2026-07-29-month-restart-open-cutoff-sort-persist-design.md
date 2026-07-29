# Month restart + open-cutoff launch + persistent sort — Design

**Date:** 2026-07-29
**Status:** Approved (Eve, in chat)

Three features, one milestone:

- **A.** "Restart month" — regenerate the current month fresh from the
  template, rolling back tick-created bookkeeping, keeping expenses.
- **B.** This Month opens at the latest unclosed cutoff: closed cutoffs
  render collapsed on load.
- **C.** The This Month line-sort choice persists across sessions.

---

## A. Restart month

### Semantics (decided)

- **Rolls back tick bookkeeping** so re-ticking records correctly. The
  reversal is **doc-driven** (reverses exactly what exists, regardless of
  line state — skipped lines already had their payments reversed and their
  status cleared, so nothing double-counts):
  - Every payment doc across all debts with `monthKey === key && lineId`
    (line-generated; Debt Plan extra payments have no `lineId` and stay):
    delete it and `increment(+amount)` that debt's `currentBalance`.
  - Every `savingsMoves` doc with `monthKey === key && incomeId` (income
    tick-generated; manual deposits/corrections have no `incomeId` and
    stay): delete it and `increment(-amount)` `meta.savingsBalance`.
- **Expenses stay** — they are real spending, not tick bookkeeping. An
  expense pointing at a deleted one-off line id becomes unplanned spending
  (existing orphan behavior in `unplannedForCutoff`).
- **Everything line-shaped is regenerated**: all line docs (including
  skipped, overridden, one-off, and event lines) and one-off month incomes
  are deleted; fresh lines come from `generateMonthLines(template, events,
  monthKey)` — the same generator `startMonth` uses. Month meta is rewritten
  with a fresh `startedAt` and `receivedIncomes: {}`.
- **Safety backup first**: `backupMonth(monthKey, "month restart")`, so
  Settings → Backups can restore the pre-restart state (with the existing
  caveat that a backup restore does not itself re-apply debt/savings
  bookkeeping — unchanged behavior).
- Debt cycles (`debts/{id}/cycles`) are untouched.

### Implementation

New `restartMonth(monthKey)` in `src/lib/repo.ts`:

1. `backupMonth(monthKey, "month restart")`.
2. Read: RAW month line ids (all must be deleted, including skipped), month
   one-off income ids, template lines, events, every debt's payments, and
   all `savingsMoves`.
3. One batch: month-scoped line-generated payment deletions + per-doc debt
   increments + month-scoped income-generated savings-move deletions +
   per-doc `savingsBalance` decrements + all line/one-off-income deletions +
   fresh line `set`s from `generateMonthLines` + meta `set`
   (`{ startedAt, receivedIncomes: {} }`).

### UI

"Restart month" action in This Month next to "Sync from template", shown
only for `editable` months, guarded by the existing `ConfirmDialog` with
copy that states what is kept and what is rolled back.

---

## B. Open at the latest unclosed cutoff

- `ThisMonth` gains per-cutoff collapsed state, initialized from the
  existing `isCutoffClosed` selector when lines first load (and re-initialized
  when browsing to another month): closed cutoffs start collapsed. An empty
  cutoff counts as open (existing `isCutoffClosed` semantics). No new
  selector — per-cutoff collapse driven by `isCutoffClosed` IS the feature. A collapsed section
  renders as a slim header bar ("✓ CLOSED" style, matching the existing
  badge) that toggles expansion on tap; expanded sections can be collapsed
  the same way.
- Ticking the last line of a cutoff mid-session does NOT auto-collapse it —
  initialization is load-time only.
- No changes to `AppShell`'s launch tab (already "month").

## C. Persistent sort

- `ThisMonth`'s `lineSort` state initializes from
  `localStorage["month-line-sort"]`, validated against `LINE_SORTS` keys
  (invalid/absent → `"order"`); the setter writes the choice back. Same
  pattern as Quick Add's `quickadd-envelope`.

---

## Testing

Vitest (`--no-file-parallelism`):

1. Sort-key validation helper (`parseLineSortKey`, exported from
   `lineSort.ts`): valid keys pass through, garbage/null falls back to
   `"order"`.
2. `isCutoffClosed` is already covered by existing tests; the collapse init
   is thin view state over it.
3. `restartMonth`'s Firestore sequence is review-covered (repo layer has no
   test seams), mirroring the tested untick/skip reversal patterns.

## Out of scope

- Restarting past (non-editable) months.
- Making backup-restore reverse debt/savings bookkeeping.
- Auto-collapsing a cutoff when it closes mid-session.
- Deleting expenses on restart.
