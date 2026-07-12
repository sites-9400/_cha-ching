# Cha-Ching — Per-Cutoff Debt Allocation Guide (Design Spec)

**Date:** 2026-07-13
**Owner:** Eve (gamaliel)
**Status:** Approved pending user review
**Parent spec:** docs/superpowers/specs/2026-07-13-cha-ching-design.md
**Milestone:** M3a (first M3 sub-milestone)

## What it is

The app shows debt *balances* and lets you log payments, but it doesn't tell you
**how much to send each debt each cutoff** — the payoff strategy the Money Map
sheet encoded. This feature adds a per-cutoff **Debt plan**: it takes each
cutoff's free cash (surplus) and allocates it across debts by the avalanche
method (minimums first, then everything left onto the #1 payoff debt), rendered
under each cutoff on **This Month**, with tap-to-pay that logs the payment on the
Debts tab and keeps both in sync.

## Goals

1. Every cutoff shows exactly where its free cash goes — "every peso has a job,"
   self-updating as balances change.
2. Minimums on cards not being attacked are always covered → no late fees.
3. Tapping a plan line logs a real payment; plan and Debts tab never drift apart.
4. Heavy months (trips/dentures) collapse to minimums naturally; a shortfall is
   flagged loudly.

## Non-goals (deferred to later M3 sub-milestones)

- Full Settings / debt CRUD editor (this feature adds only inline minimum edit).
- Stats dashboard, CSV export, App Check, income RECEIVED ticks.
- Changing how months are generated or how expense lines work.
- Savings-floor / sinking-fund allocation of free cash (all free cash → debt per
  the user's chosen full-avalanche model).

## Allocation model (the core behavior)

**Free cash for a cutoff** = that cutoff's `cutoffSummary(...).surplus`
(income − planned expense lines). Already computed in M2.

**Target debt** = the active, non-BNPL debt with `currentBalance > 0` and the
lowest `payoffOrder`. BNPL debts (`isBNPL: true`, e.g. the 0% laptop) are
excluded from the avalanche entirely.

**Per cutoff, allocate free cash in two passes, then merge to one line per debt:**
1. **Minimums pass.** For each active non-BNPL debt with `currentBalance > 0`
   that is (a) *assigned to this cutoff* by its due date and (b) *not the target*,
   reserve `min(minimum, currentBalance, remaining free cash)`. A debt with no
   minimum set reserves nothing (surfaced with a "min not set" tag on Debts).
2. **Waterfall pass.** Send all remaining free cash down the payoff order: pay the
   target to zero, spill to the next debt, and so on until free cash is exhausted
   or all debts are cleared.
3. **Merge.** Combine both passes into **exactly one `AllocLine` per debt per
   cutoff** — `amount` = its minimum-pass + waterfall-pass total, `kind` =
   `"target"` if it's the payoff-order target, `"spill"` if it received waterfall
   money without being the target, else `"minimum"`. When a line's total exceeds
   its own minimum, it carries a `min` note (e.g. "incl. ₱1,090 min"). One debt →
   one payable line → one payment action, so paid-state never double-counts.

**Due-day → cutoff assignment** (minimums shown in the cutoff before the due date,
given cutoffs 1 = 13th payday, 2 = 25th+29th paydays):
- due day **13–24 → cutoff 1**
- due day **25–31 or 1–12 → cutoff 2**
- **no `dueDay` set → cutoff 2** (the later, safer cutoff) for minimum purposes.
- The **target** debt is not restricted by cutoff — it receives leftover free cash
  in *both* cutoffs.

**Shortfall:** if free cash < sum of this cutoff's required minimums, the plan
shows the minimums it *can* cover and a red flag: "Short ₱X for minimums this
cutoff." (Free cash is never driven negative by the allocation.)

### Worked example (July 2026, real data)

1st cutoff, free cash ₱15,933:
- → REVI ₱15,933 (target #1). Surplus after ₱0.

2nd cutoff, free cash ₱34,008 (REVI now ₱1,332 after 1st cutoff; assume only
RCBC Gold's minimum ₱1,090 is set, others not yet):
- → REVI ₱1,332 (target, cleared)
- → RCBC Classic ₱6,337 (spill, cleared)
- → RCBC Gold ₱26,339 (spill; incl. ₱1,090 min)
- Surplus after ₱0.

Walk-through: minimums pass reserves Gold ₱1,090 (due 28 → cutoff 2, not target).
Waterfall pass sends the remaining ₱32,918 down the order: REVI ₱1,332, Classic
₱6,337, Gold ₱25,249. Merge → one line per debt; Gold's minimum + waterfall combine
to ₱26,339. Cards whose minimum isn't set yet (Classic, EastWest) reserve nothing
in the minimums pass — but the waterfall still reaches Classic because it's next in
the payoff order.

## Data model change

Add one optional field to the `Debt` type and its Firestore docs:

```
debts/{id}  { ...existing, minimum?: number }
```

`dueDay` already exists. No other schema change. Existing debts simply have no
`minimum` until the user sets one.

## Components & interfaces

- **`allocateCutoff(freeCash, debts, cutoff)` → `Allocation`** — new pure function
  (in `src/lib/allocate.ts`, tested). `Allocation = { lines: AllocLine[];
  shortfall: number }`, `AllocLine = { debtId, name, amount, kind:
  "minimum" | "target" | "spill", channel, minIncluded?: number }`
  (`minIncluded` is set when the line's amount folds in a reserved minimum, for the
  "incl. ₱X min" note). Exactly one line per debt. Consumes `Debt[]` (active,
  with `minimum?`, `dueDay?`, `payoffOrder`, `isBNPL`, `currentBalance`) and the
  cutoff number. Pure — no Firestore.
- **`cutoffForDueDay(dueDay)` → `1 | 2`** — pure helper (in `allocate.ts`), tested.
- **`DebtPlan` block** — rendered inside each cutoff section on `ThisMonth`,
  below the expense lines. Lists the `AllocLine`s (amount via `peso()`, channel
  chip, kind label), a "✓ paid" state per line, and the shortfall flag. A line is
  **paid** when a debt payment for that debt has been logged this month+cutoff
  (see sync).
- **`ConfirmPayDialog`** — small modal opened by tapping a plan line: shows debt
  name + editable amount (pre-filled from the alloc line) + Confirm/Cancel. On
  confirm calls `logDebtPayment(debtId, amount, monthKey)` and records the cutoff
  (see sync), then closes.
- **Inline minimum editor** on the Debts tab — each debt card gains a
  "Min ₱X · edit" / "Set minimum" control; saving calls a new repo helper
  `setDebtMinimum(debtId, amount)`.

## Sync / paid-state (no double-count)

Debt payments already store `{ amount, date, monthKey }`. Add `cutoff: 1 | 2` to
the payment doc written by the plan/confirm flow. A `DebtPlan` line for
`(debt, cutoff)` renders as **✓ paid** when a payment doc exists for that debt
with the current `monthKey` and `cutoff`. Because the plan re-derives from live
`currentBalance`, paying (from the plan OR directly on the Debts tab) updates both
views identically — the plan reads reality, it doesn't store its own copy of it.

## Error handling

- **Overpay:** `ConfirmPayDialog` caps/pre-fills at the debt's `currentBalance`
  and warns if the typed amount exceeds it ("more than the balance — pay ₱X to
  clear it?"). Confirming an overpay is allowed (user may know something the app
  doesn't) but never silently.
- **Zero/invalid amount:** Confirm is disabled unless amount > 0 (no silent
  close — fixes the M2 Debts minor).
- **Minimum not set:** plan reserves nothing for that debt and the Debts tab shows
  a "min not set" tag; not an error, just surfaced.
- **Shortfall:** plan renders the red "Short ₱X for minimums" flag; allocation
  never returns negative amounts.
- **Reversibility:** a logged payment can be undone on the Debts tab (existing
  behavior) — un-logging restores the balance and the plan line reverts to unpaid.

## Testing & verification

- **Vitest unit tests** for `allocateCutoff` and `cutoffForDueDay`:
  - 1st cutoff July → single target line REVI ₱15,933.
  - 2nd cutoff July (REVI ₱1,332, Gold min ₱1,090 set) → one line per debt: REVI
    ₱1,332 (target), Classic ₱6,337 (spill), Gold ₱26,339 (spill, incl. min).
    Order, kinds, and the merged Gold total asserted.
  - tight month: free cash only covers minimums → minimums-only, no target line.
  - short: free cash < minimums → shortfall > 0, no negative amounts.
  - `cutoffForDueDay`: 16→1, 28→2, 4→2, 10→2, boundary 24→1 / 25→2 / 12→2 / 13→1.
- **Manual/browser** (controller-driven on live site): set a minimum on a debt →
  plan updates; tap a plan line → confirm → balance drops, line shows ✓, surplus
  goes to ₱0; reload persists.

## Build order (for the implementation plan)

1. `Debt.minimum` field + `setDebtMinimum` repo helper + inline minimum editor on
   Debts tab.
2. `cutoffForDueDay` + `allocateCutoff` pure functions with full unit tests.
3. Payment doc `cutoff` field + paid-state derivation.
4. `DebtPlan` block on This Month (render allocation + shortfall + paid state).
5. `ConfirmPayDialog` + tap-to-pay wiring (overpay/zero guards).
6. Live verification + deploy.
