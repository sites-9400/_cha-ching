# Edit Logged Expenses Implementation Plan

> Executed by a Sonnet subagent (user-requested model downgrade for cost); Fable reviews, verifies, commits.

**Goal:** Tap a Recent expense in Quick Add → edit amount, category, account, Paid-from (envelope), note, and date.
**Spec:** `docs/superpowers/specs/2026-07-18-edit-expenses-design.md`

### Task 1: `updateExpense` repo function

- Modify `src/lib/repo.ts`: add next to `addExpense`/`deleteExpense`:
  - `updateExpense(id: string, patch: Partial<ExpenseInput> & { envelopeLineId?: string | null }): Promise<void>` —
    `updateDoc` on `doc(db, expensesCol(), id)`; map `envelopeLineId: null` to Firestore `deleteField()` (import from firebase/firestore). Never write `undefined`.

### Task 2: `EditExpenseDialog` component

- Create `src/components/EditExpenseDialog.tsx`, modal styled exactly like `EditLineDialog.tsx`:
  - Props: `{ expense: { id, amount, category, channel, note, date, envelopeLineId? }, categories: Category[], lines: MonthLine[], onClose }`.
  - Fields: amount (number input) · category chips · account chips (useAccounts) · "Paid from" chips (Unplanned + `lines.filter(isEnvelope)`) · note input · `<input type="date">` bound to `date.slice(0,10)`; on save keep the original time-of-day suffix.
  - Save: `updateExpense(id, {...})` with envelope `null` when Unplanned selected and the expense previously had one; disabled until amount > 0 and date valid.

### Task 3: Wire into QuickAdd

- `src/components/QuickAdd.tsx`: tapping the row body (not the ✕) sets `editing` state → mounts the dialog. Pass `categories`, `lines`.

### Verify

`npm run typecheck` + `npx vitest run` (no regressions). Manual walkthrough by user post-deploy.
