# Cha-Ching — Delete a Recurring Line from the Month — Design Spec

**Date:** 2026-07-26
**Owner:** Eve (gamaliel)
**Status:** Approved in-session

## Problem

In the month view only one-off lines carry a ✕ (`ThisMonth.tsx:184`:
`onDelete={editable && l.oneOff ? … : undefined}`). A recurring line can't be
removed from a month at all. The only way to get rid of one is Settings →
Recurring, which deletes it from the template and therefore from every future
month — there is no way to say "not this month."

The reason it was never wired up: `reconcileLines` re-creates any template line
that has no month-line match, so a plain delete would silently reappear the
next time anything triggers `syncMonthFromTemplate`.

## Design

The month row's ✕ becomes available on every line when the month is editable.
One-off lines keep today's immediate delete (`deleteMonthLine`) — there is no
template behind them. A recurring line opens a three-way dialog:

- **Just this month** — the line leaves this month and stops counting; the
  template is untouched, so it returns next month. Reversible.
- **Remove from template too** — `deleteTemplateLine(id)` followed by
  `syncMonthFromTemplate(monthKey)`, exactly what Settings → Recurring does
  today (`TemplateEditor.tsx:114-118`). Reused, not reimplemented.
- **Cancel.**

### Skipping, and why template sync can't undo it

New optional field: `MonthLine.skipped?: boolean`.

"Just this month" writes `{ status: "", paidDate: "", overridden: true,
skipped: true }` onto the month line. The `overridden` flag is what protects
it: `reconcileLines` already skips overridden lines in its upsert loop
(`reconcile.ts:43`) and excludes them from `deletes` (`reconcile.ts:70`). So a
skipped line is never resurrected, never clobbered, and **`reconcile.ts` needs
no change whatsoever.** The doc is kept rather than deleted so the skip can be
undone.

### Reversing a PAID debt payment

A recurring line that pays a debt and is ticked PAID has already logged a
payment document and decremented the debt's balance. Deleting it naively would
orphan that payment — and because the payment carries a `lineId`, the month CSV
export would drop it too, so the money would vanish from the record entirely.

New repo function, one atomic `writeBatch`, mirroring `toggleLinePaid`'s untick
path (`repo.ts:54-63`):

```ts
export async function skipLineForMonth(monthKey: string, line: MonthLine): Promise<void>
```

1. If `line.status !== ""` and `line.debtId` is set: read that debt's payments,
   and for each doc whose `lineId === line.id`, `batch.delete` it and
   `batch.update` the debt with `currentBalance: increment(+amount)`.
2. `batch.update` the line with `{ status: "", paidDate: "", overridden: true,
   skipped: true }`.
3. Commit.

Single batch, so a failure can never leave a restored balance without its
payment record, or vice versa.

Undo is `unskipLine(monthKey, id)` → `{ skipped: false, overridden: false }`.
Clearing `overridden` re-arms template sync so the line refreshes from the
template next time.

### Making a skipped line invisible to the math

Four places read month lines straight from Firestore, so filtering inside
`MonthProvider` alone would not be enough:

| Site | Why it matters |
|---|---|
| `MonthProvider.tsx:43` | feeds every money selector and the CSV export |
| `QuickAdd.tsx:19` | envelope "paid from" chips — must not offer a skipped budget |
| `SpendingCalendar.tsx:31` | dashboard calendar |
| `TemplateEditor.tsx:31` | closed-cutoff notice and delete counterpart |

One pure helper in `src/lib/selectors.ts`, applied at all four:

```ts
/** Month lines that count. Skipped lines are hidden from the month and from
 *  all money math. Pure. */
export const activeLines = <T extends { skipped?: boolean }>(lines: readonly T[]): T[] =>
  lines.filter((l) => !l.skipped);
```

Everything downstream — planned totals, envelope pools, `isCutoffClosed`, the
debt plan, the send plan, and the month CSV export — inherits the behaviour
without individual changes, because they all consume already-filtered lists.

`MonthProvider` additionally exposes `skippedLines: MonthLine[]` (the
complement) so the month view can render the undo affordance. Projected months
generate their lines from the template and have no skipped concept, so the
filter is a no-op there.

### UI

- `ThisMonth.tsx`: `onDelete` is provided for every line when `editable` and
  the cutoff is **not** closed. One-off → delete immediately (today's
  behaviour). Recurring → open the dialog.
- Skipped lines render dimmed at the bottom of their cutoff section:
  `Netflix · skipped this month` with an `undo` button.
- `ConfirmDialog` gains two optional props so it can offer a second action
  without forking the component:

```ts
secondaryLabel?: string;
onSecondary?: () => void | Promise<void>;
```

  When `onSecondary` is absent the dialog renders exactly as it does today, so
  every existing call site is unaffected.

## Error handling

- Closed cutoffs are frozen everywhere else in the app, so no ✕ appears on
  their lines and skipping there is impossible.
- A line whose debt was deleted: the payment-reversal loop simply finds no
  matching debt doc to update; the skip still completes.
- Undo on a line whose template entry has since been deleted leaves an
  unskipped, non-overridden line, which the next `syncMonthFromTemplate`
  removes — correct, since the template no longer has it.
- If the template entry is deleted while the line is still skipped, the skipped
  doc is not cleaned up: `reconcileLines`' `deletes` filter excludes overridden
  lines, and a skipped line is always overridden. It remains in Firestore,
  permanently hidden by `activeLines` and absent from every calculation. This
  is the accepted cost of the `overridden` flag being what stops template sync
  from resurrecting the line.

## Testing

New tests in `src/lib/selectors.test.ts`:

1. `activeLines` drops lines flagged `skipped`
2. `activeLines` keeps lines with `skipped: false` and with the field absent
3. `isCutoffClosed` reports closed when the only unticked line is skipped
   (fed through `activeLines`, proving the filter composes)

New tests in `src/lib/reconcile.test.ts`:

4. a skipped (`overridden: true, skipped: true`) line is neither upserted nor
   deleted when its template line still exists — it is not resurrected
5. the same line stays put when its template line has been removed

Repo writes and UI are verified by `npm run typecheck`, `npx vitest run
--no-file-parallelism`, `npm run build`, and a manual walkthrough: skip a plain
recurring line, confirm the cutoff total drops and the undo restores it; skip a
PAID debt line, confirm the debt balance goes back up and the payment
disappears from the month CSV export; confirm Settings → Recurring still
deletes template-wide.

## Out of scope

- Skipping a line in a closed cutoff.
- Bulk skip / "skip for the next N months".
- Preserving an inline edit across skip → undo (undo re-arms template sync, so
  a previously overridden line refreshes from the template).
