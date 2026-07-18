# Cha-Ching — Edit Logged Expenses — Design Spec

**Date:** 2026-07-18
**Owner:** Eve (gamaliel)
**Status:** Approved in-session

## Problem

Quick Add expenses can only be deleted, not edited. Expenses logged before the
envelope feature existed can't be retagged to Allowance, and a wrong amount,
category, account, note, or date requires delete + re-enter.

## Design

- **Open:** tapping an expense row in Quick Add's Recent list opens an
  "Edit expense" modal (same styling as `EditLineDialog`). The existing ✕
  delete button on the row is unchanged.
- **Fields:** amount (number input) · category chips · account chips ·
  "Paid from" chips (Unplanned + the current month's envelope lines) · note ·
  date (`<input type="date">`, edits the day while preserving the stored
  ISO format).
- **Component:** new `src/components/EditExpenseDialog.tsx`; mounted from
  `QuickAdd.tsx` with the tapped expense.
- **Repo:** new `updateExpense(id, patch)` in `src/lib/repo.ts` using
  `updateDoc`. Selecting Unplanned removes `envelopeLineId` with Firestore's
  `deleteField()` (undefined values are rejected).
- **Math:** no selector changes — envelope bars, free cash, and the debt plan
  recompute live from the `expenses` collection, so a retagged expense
  immediately moves between "unplanned" and its envelope's drawdown.

## Error handling

- Save disabled until amount > 0 and date is valid.
- Envelope chips list the current month's envelope lines; an expense linked to
  a line that no longer exists shows as Unplanned (matches selector fallback).

## Testing

Money math already covered by `envelopeSpent` / `unplannedForCutoff` tests.
This change is UI + one repo write: verified by `npm run typecheck`,
`npx vitest run` (no regressions), and a manual on-phone walkthrough
(edit amount, retag to Allowance, retag back to Unplanned, change date).

## Out of scope

- Editing expenses older than the 8-row Recent list (delete/re-add remains).
- Bulk retagging.
