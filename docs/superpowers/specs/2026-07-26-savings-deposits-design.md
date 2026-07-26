# Cha-Ching — Savings Deposits & Income Routed to Savings — Design Spec

**Date:** 2026-07-26
**Owner:** Eve (gamaliel)
**Status:** Approved in-session

## Problem

Money *out* of savings is modelled properly: a `fundedBySavings` expense skips
cutoff math and adjusts `meta.savingsBalance` by delta, atomically and
reversibly (`repo.ts:99,144`). Money *in* has no path at all. The only way to
add to savings is Dashboard → Savings → tap the balance → type a new total
(`SavingsMeter.tsx:37` → `updateMeta({ savingsBalance: v })`). That is an
overwrite, not a deposit: you do the arithmetic yourself, and nothing records
how much arrived, when, or from where.

There is also no way to say "this income stream goes straight to savings" — a
side-gig payment has to be received as spendable cash and then manually typed
into the savings balance.

## Design

Two connected pieces: a deposit/withdrawal action backed by a history, and a
per-income-source "goes to savings" flag.

### Data

New collection `households/main/savingsMoves/{id}`:

```ts
export interface SavingsMove {
  id: string;
  amount: number;          // always positive; `direction` carries the sign
  direction: "in" | "out";
  source: string;          // free text — "Side gig", "Correction", an income name
  date: string;            // ISO
  incomeId?: string;       // set when created by ticking a toSavings income
  monthKey?: string;       // ditto — together these locate the move to reverse
}
```

`Income` gains one optional field:

```ts
  toSavings?: boolean;     // received money goes to savings, not spendable cash
```

New path helper: `savingsMovesCol = (): string => col("savingsMoves")`.

### Writes

```ts
addSavingsMove(move: Omit<SavingsMove, "id">): Promise<void>
deleteSavingsMove(move: SavingsMove): Promise<void>
```

Each is a single `writeBatch`: write (or delete) the move document **and**
`increment` `meta.savingsBalance` by `+amount` for `in`, `-amount` for `out`
(reversed on delete). Because both happen in one batch, the balance can never
drift from the history that explains it.

### The manual balance edit becomes a Correction

`SavingsMeter`'s type-over-the-balance edit stays — it is the escape hatch when
reality and the app disagree. But it now records what it did: on save, the
delta against the previous balance is written as a move with
`source: "Correction"` (`direction` from the delta's sign). The `increment`
lands the balance on exactly the number typed, and the audit trail survives.
A zero delta writes nothing.

### Recent list — a merge, not a new write path

The history shown under the balance merges two sources, both already available:

- `savingsMoves` — explicit deposits, withdrawals, corrections, income sweeps.
- `expenses` where `fundedBySavings` is true — withdrawals that already exist.

This is deliberate: `updateExpense`'s delta handling is the most delicate money
code in the app, and adding a second write to it risks double-counting. Reading
the expenses collection costs nothing and cannot drift.

A pure helper in the new `src/lib/savings.ts`:

```ts
export interface SavingsEntry {
  id: string;
  date: string;
  amount: number;             // positive
  direction: "in" | "out";
  source: string;
  kind: "move" | "expense";   // expense rows are read-only in the UI
}

export function savingsHistory(
  moves: readonly SavingsMove[],
  expenses: readonly { id: string; amount: number; date: string; note?: string; category?: string; fundedBySavings?: boolean }[],
  limit?: number,
): SavingsEntry[];
```

Sorted by `date` descending, capped at `limit` (default 8). An expense entry is
always `direction: "out"`, `kind: "expense"`, with `source` taken from its
`note`, falling back to `category`, falling back to `"Expense"`.

### Income routed to savings

Semantics chosen: the income **counts** in the cutoff's income total and is
simultaneously spoken for, so surplus is unchanged.

`cutoffSummary` gains an optional fourth parameter and two rules:

```ts
export function cutoffSummary(
  lines: MonthLine[],
  incomes: Income[],
  cutoff: 1 | 2,
  received?: Record<string, boolean>,
): CutoffSummary
```

- Every income in the cutoff counts toward `income`, exactly as today.
- An income with `toSavings` **also** adds its amount to `planned` — it is
  money already committed elsewhere. `surplus = income - planned` therefore
  lands identically to today.
- A `toSavings` income that is **received** also adds its amount to `ticked`,
  so the cutoff's progress bar (`ticked / planned`) can still reach 100%.
  Without this the bar would be permanently short by the swept amount.

Ticking such an income RECEIVED credits savings. `setIncomeReceived` changes
signature from `(monthKey, incomeId, received)` to `(monthKey, income, received)`
because it now needs the amount, name, and flag:

- **Receiving:** batch — merge `receivedIncomes[income.id] = true` onto the
  month doc, `increment` `savingsBalance` by the amount, and write a
  `SavingsMove` carrying `incomeId` and `monthKey`.
- **Un-receiving:** read `savingsMoves` for the matching `incomeId` +
  `monthKey`, then batch — merge the flag to `false`, `increment` the balance
  back down, and delete that move. This mirrors `toggleLinePaid`'s untick path
  (`repo.ts:54-63`).

An income without `toSavings` behaves exactly as it does today.

### UI

- `SavingsMeter` gains a **+ Add to savings** button opening a small dialog:
  amount, an in/out direction toggle, source text, date (defaults to today).
  The direction toggle is included because money eventually leaves savings for
  something you don't want logged as an expense, and without it the only route
  back is typing over the balance.
- New `src/components/dashboard/SavingsHistory.tsx` renders `savingsHistory()`
  under the meter. Move rows carry a ✕ (`deleteSavingsMove`); expense-derived
  rows are read-only, since they are edited in Quick Add.
- **Goes to savings** checkbox in Settings → Income sources (`IncomesEditor`)
  and in Add one-off → Income (`AddOneOff`).
- In `ThisMonth`, an income flagged `toSavings` is labelled (e.g.
  `↓ Side gig → savings`) so it is obvious why it is not spendable.

## Error handling

- Save is disabled until amount > 0 and a source is non-empty.
- Deleting a move whose income still shows RECEIVED is allowed; the balance is
  reversed correctly and the income's tick is left alone (the tick is display
  state on the month doc, not the source of truth for the balance).
- Un-receiving an income whose move was already deleted by hand: the lookup
  finds nothing, so the batch only clears the flag — the balance is not
  double-decremented.
- A `toSavings` income that is never received does not block
  `isCutoffClosed`, which only inspects lines. A cutoff can therefore read
  CLOSED with a savings sweep still pending; accepted, since closing tracks
  bills paid, not money moved.

## Testing

New `src/lib/savings.test.ts`:

1. `savingsHistory` merges moves and `fundedBySavings` expenses into one list
2. sorted by date descending
3. respects `limit`, default 8
4. ignores expenses not flagged `fundedBySavings`
5. expense `source` falls back note → category → `"Expense"`
6. expense entries are `direction: "out"`, `kind: "expense"`

Added to `src/lib/selectors.test.ts`:

7. a `toSavings` income adds to both `income` and `planned`; `surplus` matches
   the same month without the flag
8. a received `toSavings` income adds to `ticked`; an unreceived one does not
9. a normal income is unaffected by the new `received` parameter (regression)

Plus `npm run typecheck`, `npx vitest run --no-file-parallelism`,
`npm run build`, and a manual walkthrough: deposit ₱5,000 and confirm the
balance and history both move; delete it and confirm both reverse; type over
the balance and confirm a Correction row appears; flag an income "goes to
savings", tick it RECEIVED, and confirm savings rises, the history shows it,
surplus is unchanged, and unticking reverses everything.

## Out of scope

- Income channel per source and the shortfall-aware send plan — spec B.
- Writing a `SavingsMove` from the `fundedBySavings` expense path (the merge
  makes it unnecessary).
- Sinking funds, which already have their own balances and release schedule.
- Editing an existing move (delete and re-add).
