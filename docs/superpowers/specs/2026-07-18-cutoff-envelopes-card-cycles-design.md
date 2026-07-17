# Cha-Ching — Closed Cutoffs, Envelopes & Card Cycles — Design Spec

**Date:** 2026-07-18
**Owner:** Eve (gamaliel)
**Status:** Approved in-session; pending user review of this document

## Problem

Three related gaps in the debt/expense/payment logic:

1. **Template edits retroactively modify finished cutoffs.** Adding a recurring
   template line in Settings immediately runs `syncMonthFromTemplate` on the
   current month, inserting the new (unticked) line into a cutoff the user has
   already fully allocated and paid. The app has no concept of a "finished"
   cutoff.
2. **Allowance spending is double-counted.** The Allowance line already reduces
   the cutoff surplus as a planned expense; when the user then spends from that
   allowance and logs it in Quick Add, `unplannedForCutoff` subtracts the same
   pesos from free cash a second time. There is no link between a Quick Add
   expense and the planned line (envelope) that funds it.
3. **Cards have no statement dates.** Debts carry only `dueDay` and a static
   `minimum`; there is no statement day, no per-cycle statement balance or
   minimum due, and no visibility of upcoming payment deadlines.

## Design

### 1. Closed cutoffs

**Definition (computed, never stored):** a cutoff of a started month is
*closed* when it has at least one line and every line in it has a non-blank
status. New pure selector in `selectors.ts`:

```ts
isCutoffClosed(lines: MonthLine[], cutoff: 1 | 2): boolean
```

**Behavior:**

- `reconcileLines(template, monthLines, closedCutoffs)` takes the set of
  closed cutoffs and emits **no upserts and no deletes** for lines whose
  cutoff is closed — frozen means frozen. A new template line targeted at a
  closed cutoff does not touch the current month; it appears when the next
  month is started.
- `syncMonthFromTemplate` computes the closed set from the month's lines
  before reconciling and passes it through.
- Template editor: after saving a line whose cutoff is closed for the current
  month, show a note — "Cutoff 1 is closed for July — this line starts in
  August."
- Add one-off: the cutoff picker still allows both cutoffs (explicit user
  choice) but labels a closed one, e.g. "1 (closed)", since adding an unticked
  line reopens it by definition.
- This Month: a cutoff section whose lines are all ticked shows a ✓ CLOSED
  badge next to its header.

### 2. Envelopes (expenses tied to planned lines)

**Schema:**

- `TemplateLine`/`MonthLine` gain `isEnvelope?: boolean` (toggle in Settings →
  template editor and in the month line edit dialog).
- Expense docs gain `envelopeLineId?: string` — the id of the month line the
  spending draws from. Absent = unplanned.

**Quick Add UI:** a "Paid from" chip row listing the current month's envelope
lines plus "Unplanned". Defaults to the last-used choice (localStorage).

**Math (each peso counted exactly once):**

- Envelope-linked expenses do **not** reduce free cash. They draw down the
  envelope: `envelopeSpent(expenses, lineId)` sums the month's linked
  expenses; the envelope's LineRow shows remaining ("₱6,300 left of ₱10,000")
  with a mini progress bar.
- If an envelope overspends, only the excess
  (`max(0, spent − line.amount)`) counts against free cash in that line's
  cutoff.
- `unplannedForCutoff` counts only envelope-less expenses. It keeps the
  day-based cutoff rule (13–24 → 1, else 2) but **skips closed cutoffs**:
  if the date-derived cutoff is closed, the expense attributes to the other
  cutoff if open; if both are closed, it reduces nothing (tracking-only).

### 3. Credit-card cycles (statement dates, deadlines, statement amounts)

**Schema:**

- `Debt` gains `statementDay?: number` (1–31). `dueDay` and `minimum` remain
  and act as fallbacks.
- New subcollection `debts/{id}/cycles/{YYYY-MM}` (key = statement month):

```ts
interface DebtCycle {
  statementDate: string;   // ISO date the statement cut
  dueDate: string;         // ISO date payment is due
  statementBalance: number;
  minimumDue: number;
}
```

- New pure module `src/lib/cycles.ts`: current-cycle key for a date,
  statement/due date computation from `statementDay`/`dueDay` (due date is
  the next `dueDay` occurrence strictly after the statement date, possibly in
  the following month), paid-this-cycle (payments dated within
  `[statementDate, nextStatementDate)`), and days-until-due.

**Entry flow:** once a card's statement day has passed and no cycle doc exists
for that cycle, its card on the Debts screen shows an "Enter statement" chip →
dialog pre-filled with statement balance = `currentBalance` and minimum due =
static `minimum`. Only cards with a `statementDay` participate.

**Debt plan integration (`allocateCutoff` minimums pass):** for a non-target
card with a current-cycle doc, the reserved minimum is
`max(minimumDue − paidThisCycle, 0)` instead of the static `minimum`,
assigned to the cutoff derived from the card's real due date
(`cutoffForDueDay` on the cycle's due date's day). Cards without cycle data
behave exactly as today.

**Deadline visibility:**

- Debts cards show "stmt 15th · due 10th · due in N days" plus a
  paid-vs-minimum progress indicator for the current cycle.
- A "due soon" strip on This Month and Debts lists cards whose current-cycle
  due date is within 7 days and whose cycle minimum is not fully paid, e.g.
  "REVI · due Jul 16 · ₱0 of ₱1,700 min paid."

## Error handling

- Closed-ness is derived per render/sync from live data — no stored flag to
  drift. Un-ticking any line naturally reopens the cutoff.
- Envelope deletion: expenses referencing a deleted month line fall back to
  unplanned (id lookup misses → treated as no envelope).
- Cycle entry is idempotent per cycle key; re-entering overwrites that
  cycle's doc after a confirm.
- Debts without `statementDay` (e.g. BNPL, informal debts) never prompt for
  statements and keep today's behavior.

## Testing

Vitest-first on the pure modules:

- `selectors`: `isCutoffClosed` (empty cutoff, partial, all ticked);
  `unplannedForCutoff` skip-closed matrix (open/closed × cutoff 1/2, both
  closed → 0); envelope spent/excess math.
- `reconcile`: closed cutoff produces no upserts/deletes; open cutoff
  unchanged behavior; mixed (cutoff 1 closed, 2 open).
- `cycles`: cycle key boundaries (statement day = 1, 31, month ends),
  due-date-in-next-month (stmt 15 due 10), paid-this-cycle windowing,
  days-until-due.
- `allocate`: cycle minimum replaces static minimum; partial cycle payment
  reduces the reserve; no cycle doc → fallback to static minimum.

UI wiring verified manually: template add while cutoff closed, Quick Add with
envelope picker, statement entry, due-soon strip.

## Execution & model usage

Implementation runs as subagent-driven development: **Sonnet** subagents
implement the tasks, **Haiku** subagents run mechanical verification
(typecheck/tests), and the main model only orchestrates and reviews — chosen
deliberately to limit usage.

## Out of scope

- Notifications/push reminders for due dates (in-app strip only).
- Automatic statement import; entry stays manual.
- Changing the salary-window cutoff rule (13–24 → 1) itself.
