# Card-paid expenses + "Paid first" line sort — Design

**Date:** 2026-07-29
**Status:** Approved (Eve, in chat)

Two independent features, one milestone:

- **A.** An expense can be paid with a credit card (or any active debt); the
  amount is added to that debt's balance instead of hitting this month's cash.
- **B.** A fifth month-line sort option, **Paid first**, that puts ticked lines
  above unticked ones.

---

## A. Card-paid expenses

### Semantics (decided)

- **Debt only, no cash hit.** A card-paid expense adds to the debt's
  `currentBalance` and skips all envelope / budget-group / free-cash math.
  The budget feels it later through the existing statement/minimum flow when
  the bill is paid. This mirrors `fundedBySavings` exactly.
- **All active debts are selectable** — credit cards and BNPL alike, not just
  `statementDay` debts.
- **Mutually exclusive funding.** `paidWithDebtId`, `fundedBySavings`,
  `envelopeLineId`, and `budgetGroup` are alternatives; setting one clears the
  others. Enforced by the single-choice "Paid from" row.
- Card charges **still count as spending** in category bars, spending
  calendar, and the Quick Add "spent this month" header — only the *cash*
  math defers.
- `DebtCycle.statementBalance` stays user-entered; a charge moves
  `currentBalance` (and available credit) immediately but never writes cycles.

### Data model

`ExpenseInput` (`src/lib/repo.ts:120`) gains:

```ts
paidWithDebtId?: string; // debt charged for this expense — skips cutoff math, grows debt balance
```

Local `Expense extends ExpenseInput` re-declarations (QuickAdd,
EditExpenseDialog, ExportData) inherit it for free. No new collections, no
payment docs, no charge docs — per-card charge history is derivable by
querying expenses on `paidWithDebtId`.

### Writes (`src/lib/repo.ts`)

All changes follow the existing batch + `increment()` discipline:

- **`addExpense`** — if `paidWithDebtId`, add
  `batch.update(debtDoc, { currentBalance: increment(+amount) })`.
- **`deleteExpense`** — already reads the stored doc; if the *stored* doc has
  `paidWithDebtId`, reverse with `increment(-amount)`. Guard: `getDoc` the
  debt first and skip the reversal if the debt no longer exists (a batched
  update against a deleted doc would fail the whole batch).
- **`updateExpense`** — extend the existing savings delta logic to debts:
  compute old (debtId, amount) vs new (debtId, amount); reverse the old
  amount on the old debt and apply the new amount on the new debt (up to two
  debt docs in one batch). Handles card→card, card→savings, savings→card,
  card→none, and amount edits. `null` clears via `deleteField()`, matching
  the existing `envelopeLineId`/`fundedBySavings`/`budgetGroup` handling.
  Same missing-debt guard as delete.

### Budget math (`src/lib/selectors.ts`)

`unplannedForCutoff` gets one early skip beside the existing
`fundedBySavings` one (currently line 121):

```ts
if (e.paidWithDebtId) continue;
```

`ExpenseLike` gains the optional field. Nothing else in cutoffs, allocation,
or cycle math changes.

### UI

- **QuickAdd "Paid from" row** (`QuickAdd.tsx:123-155`): one chip per active
  debt, after the Savings chip, labeled with the debt name (💳 prefix).
  Sentinel `@debt:{id}` alongside the existing `@savings` / `@group:{name}` /
  line-id sentinels, so `localStorage["quickadd-envelope"]` persistence works
  unchanged. Validation mirrors the `activeEnvelope` check: if the remembered
  debt is gone or inactive, fall back to Unplanned.
- **`save()`** maps `@debt:{id}` → `paidWithDebtId`, clearing the other
  funding fields.
- **EditExpenseDialog**: mirror the chips; `save()` diffs against `was` and
  sends `null` to clear, per its existing pattern.
- **Expense rows** (This Month list): small badge with the debt name so a
  card charge is distinguishable from cash spend.
- **Settings → expenses CSV** (`ExportData.tsx`): new "paid with" column
  (debt name, blank for cash).
- **Month CSV export** (`monthExport.ts`): deliberately untouched — no
  payment doc is written, so no bogus "Extra payment" rows can appear.

### Savings ledger

Untouched. `savingsHistory` merges moves + `fundedBySavings` expenses only;
card-paid expenses never enter it.

---

## B. "Paid first" line sort

- `src/lib/lineSort.ts`: `Sortable` gains `status: LineStatus`; new key
  `paid` with label **Paid first** appended to `LINE_SORTS`.
- Comparator: lines with any non-empty status (`PAID`, `RECEIVED`,
  `TRANSFERRED`, `SENT`) sort above empty-status lines; ties keep manual
  `order` within each group.
- `ThisMonth.tsx` needs no changes — the chip row renders from `LINE_SORTS`
  and month lines already carry `status`.
- Sort choice remains non-persisted (resets to Default on load), matching
  current behavior.

---

## Testing

Vitest (run with `--no-file-parallelism` — Dropbox mount):

1. `unplannedForCutoff` skips `paidWithDebtId` expenses (mirror of the
   existing `fundedBySavings` test).
2. `lineComparators.paid`: ticked above unticked; stable `order` within
   groups; all four non-empty statuses count as ticked.
3. `updateExpense` delta cases if the repo layer has test seams; otherwise
   covered by review (Firestore batch logic, consistent with the tested
   savings delta pattern).
4. Existing suite green; `tsc` and `vite build` pass.

## Out of scope

- Auto-linking `Expense.channel` (e.g. "RCBC CREDIT") to a debt.
- Deriving `statementBalance` from charges.
- A `charges` subcollection / audit trail.
- Persisting the line-sort choice.
