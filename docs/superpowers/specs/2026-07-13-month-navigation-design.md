# Cha-Ching — Month Navigation, Projections & One-Off Lines (Design Spec)

**Date:** 2026-07-13
**Owner:** Eve (gamaliel)
**Status:** Approved pending user review
**Parent spec:** docs/superpowers/specs/2026-07-13-cha-ching-design.md
**Milestone:** M6 (month lifecycle; follows M3a–M5)

## What it is

Today the app only ever shows the current month, template edits never reach an
already-started month, and there's no way to add a one-off to the current month.
This milestone makes the month a navigable, living thing:

1. **Month navigation** — page across past (read-only history), current (editable),
   and future (projected) months.
2. **Projections** — a not-yet-generated month is shown computed live from the
   template + that month's events, including a **forward-simulated debt plan** so
   heavy months visibly collapse the plan to minimums.
3. **One-off lines on the current month** — add a one-off **expense line** or
   **one-off income** directly, without waiting for a future generation.
4. **Template → current-month reconcile** — editing template lines updates the
   current month's template-derived lines in place, **preserving status ticks and
   one-off lines**.

## Why (the two gaps this closes)

- Events are only usable for future months (they inject at generation), but there
  was no way to *see* a future month — so events felt broken. Navigation makes them
  visible and useful.
- You couldn't add a one-off to the current month at all; Quick Add logs actual
  spend, not a planned line.
- Template edits silently didn't reach the current month, which felt like a bug.

## Navigation & month modes

`ThisMonth` gains a `‹  {Month Year}  ›` header. The viewed month is state
(`viewedKey`), starting at `currentMonthKey()`; arrows step via
`addMonths(viewedKey, ±1)`. Mode is derived by comparing `viewedKey` to the current
key:

- **Past** (`viewedKey < current`) → read-only history: its saved lines/incomes if
  the month exists, else a read-only projection (a month that was skipped). No
  status toggles, adds, or pay.
- **Current** (`viewedKey === current`) → editable: auto-generated if missing,
  tap-to-pay, one-off adds, RECEIVED ticks.
- **Future, not yet started** (`viewedKey > current`, no month doc) → a
  **projection** labelled "Projected", computed live and never written, with a
  **"Start {Month}"** button.
- **Future, started** (`viewedKey > current`, month doc exists) → **editable**, just
  like the current month. Reached by pressing "Start {Month}" on a projection (or by
  arriving there naturally later).

So **editable** = the current month, or any future month that has been started;
**projected** = a future month with no doc yet; **past** = read-only. Only the
current month **auto**-generates; future months are created only by an explicit
**Start**, never by merely viewing them.

**Start this month** — the "Start {Month}" button calls `startMonth(key)`, which
writes the month for real (`generateMonthLines(template, events, key)` +
`writeMonth`), turning the projection into an editable month you can prep ahead of
time. Idempotent: arriving at that month later never regenerates it.

## Projection (read-only, computed live)

For a projected month `k`:
- **Lines** = `generateMonthLines(template, events, k)` (existing pure fn) — template
  lines + that month's events as one-off lines.
- **Incomes** = template incomes (+ any month-scoped one-off incomes if the month
  doc happens to exist).
- **Surplus / free cash** per cutoff via existing `cutoffSummary`.
- **Debt plan** = forward-simulated (below).

## Forward-simulated projected debt plan

New pure functions (in `src/lib/project.ts`, TDD):

- **`applyAllocation(debts, allocation)` → `Debt[]`** — returns debts with each
  allocation line's `amount` subtracted from that debt's `currentBalance` (floored
  at 0). Pure.
- **`simulateBalances(debts, steps)` → `Debt[]`** — folds the months between now and
  the target. `steps` is an ordered list of `{ c1: number, c2: number }` (each
  month's projected free cash per cutoff). For each step it runs
  `allocateCutoff(c1, bal, 1)` → `applyAllocation`, then
  `allocateCutoff(c2, …, 2)` → `applyAllocation`, carrying balances forward. Pure.

**Component wiring:** to project month `k`, build `steps` for every whole month
strictly between the current month and `k` (each month's `{c1,c2}` free cash from
`generateMonthLines`+`cutoffSummary`), run `simulateBalances(liveDebts, steps)` to
get balances at the start of `k`, then render `k`'s two cutoffs with
`allocateCutoff` on those simulated balances (cutoff 2 on post-cutoff-1 balances).

**Stated assumption** (shown as a caveat): the projection starts from today's live
balances and assumes each future month's free cash follows the plan; the current
month's not-yet-made payments are not pre-applied. Good enough to show the shape;
labelled so it's never mistaken for a guarantee.

## One-off lines on the current month

An **"+ Add one-off"** control on the current month opens a small form with an
Expense / Income toggle:

- **Expense line** → a `MonthLine` (`oneOff: true`, blank status) written to
  `months/{key}/lines` via `addMonthLine`. Renders like an event one-off; countable
  as planned expense in `cutoffSummary`.
- **One-off income** → a doc in a **new** `months/{key}/incomes` subcollection
  (shape = `Income`: name, amount, day, cutoff) via `addMonthIncome`. `ThisMonth`
  merges template incomes + month incomes for display and for `cutoffSummary`, so it
  raises that cutoff's income/surplus without recurring. Gets the same RECEIVED tick
  (its id feeds `receivedIncomes`).

Both are deletable (`deleteMonthLine`, `deleteMonthIncome`) from any **editable**
month (current or started-future). Adding/deleting is disabled on past and
projected (unstarted-future) months.

## Template → current-month reconcile

New repo fn **`syncMonthFromTemplate(monthKey)`** (batch, current month only):
- Read template lines + the month's lines.
- For each **template line T**: the month line with `id === T.id` (template-derived
  lines keep the template id) is **updated** with `{name, amount, channel, cutoff,
  order}` but **keeps** its `{status, paidDate}`; if absent, it's **added** (blank
  status, `oneOff:false`).
- Each **non-one-off** month line whose `id` is no longer a template id is
  **deleted** (template line removed).
- **`oneOff:true` lines are never touched** (events + manual one-offs preserved).

**Triggers:** called after every template-line change in Settings
(`addTemplateLine`/`updateTemplateLine`/`deleteTemplateLine`), and available as a
manual **"Sync from template"** button on the current month. (Template *income*
edits already reflect immediately — incomes are read live, not snapshotted — so only
lines need reconciling.)

## Data model

- **New:** `months/{YYYY-MM}/incomes/{id}` = `Income` (one-off month incomes).
  New path helper `monthIncomes(key)`.
- One-off expense lines reuse the existing `months/{key}/lines` + `MonthLine` shape.
- No change to `Debt`, template, or event shapes.

## Components & interfaces

- **`MonthProvider`** — reworked to expose `{ viewedKey, mode, goPrev, goNext,
  isCurrent, lines, incomes, ready }`, subscribing to the *viewed* month's
  lines/incomes/meta (subscriptions re-run when `viewedKey` changes). Current-month
  auto-generation logic unchanged, gated to `viewedKey === currentKey`.
- **`ThisMonth`** — month header + arrows; read-only / editable / projected by mode;
  "+ Add one-off" and "Sync from template" on editable months; a "Projected — assumes
  you follow the plan" banner + **"Start {Month}"** button on projected months.
- **`AddOneOff`** dialog — Expense/Income toggle + fields (name, amount, channel,
  cutoff; day for income).
- **`project.ts`** — `applyAllocation`, `simulateBalances` (pure, tested).
- **`repo.ts`** — `addMonthLine`, `deleteMonthLine`, `addMonthIncome`,
  `deleteMonthIncome`, `syncMonthFromTemplate`, `startMonth`.
- **`TemplateEditor`** — calls `syncMonthFromTemplate(currentMonthKey())` after
  save; on **delete**, warns (naming a PAID counterpart) before delete + reconcile.

## Error handling

- Past/future months are strictly read-only (no writes possible from those views).
- `syncMonthFromTemplate` preserves ticks and one-offs by construction; it never
  regenerates or clears a month. It is idempotent (a no-op when already in sync).
- Projection never writes to Firestore.
- One-off add rejects blank name / non-positive amount.
- **Deleting a template line warns first.** The `TemplateEditor` delete confirm
  checks the current month for a counterpart line; if one exists the dialog says it
  will also be removed from the current month, and **names it as PAID** when it is,
  so a recorded tick is never discarded silently. Only on confirm does the delete +
  reconcile run. (Any debt payment already logged from that line stays in the debt's
  own history regardless — payments are independent of the line.)

## Testing & verification

- **Vitest:** `applyAllocation` (subtract, floor at 0, ignore BNPL untouched),
  `simulateBalances` (multi-month fold, target-start balances), and a reconcile
  helper if the diff logic is extracted as a pure function
  (`reconcileLines(template, monthLines)` → `{ upserts, deletes }`, preserving
  status) — tested for add/update-keeps-status/delete/one-off-preserved.
- **Manual/browser:** page to August → see projected lines incl. events, surplus,
  and a plan built on lower simulated balances; page back to July (editable); add a
  one-off expense and a one-off income to July → surplus updates, RECEIVED tick works;
  edit a template line in Settings → July updates but PAID ticks and one-offs survive;
  past month shows read-only.

## Build order (for the implementation plan)

1. `project.ts` (`applyAllocation`, `simulateBalances`) + `reconcileLines` pure fns
   with tests.
2. Data model + repo: `monthIncomes` path; `addMonthLine`/`deleteMonthLine`/
   `addMonthIncome`/`deleteMonthIncome`; `syncMonthFromTemplate`; `startMonth`.
3. `MonthProvider` rework: viewed month + modes (incl. started-future) + month-scoped
   incomes subscription.
4. `ThisMonth`: nav header + read-only/editable/projected modes + merged incomes.
5. Projection rendering (future months) with the forward-simulated plan + caveat
   banner + **"Start {Month}"** button.
6. `AddOneOff` dialog (expense + income) wired to editable months.
7. Template reconcile: auto-trigger after template save; **delete-warns** flow +
   manual "Sync from template" button.
8. Live verification + deploy.
