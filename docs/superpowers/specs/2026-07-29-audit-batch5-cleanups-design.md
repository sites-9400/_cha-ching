# Audit batch 5 — Cleanups

**Date:** 2026-07-29 · **Status:** Approved (audit remediation, Eve: "go do by batch")

Behavior-preserving refactors. Typecheck + full suite must stay green; NO
user-visible changes.

## 1. Canonical `Expense` type

The same Firestore doc has 8 shapes. Consolidate:

- `src/lib/types.ts`: move `ExpenseInput` here (verbatim from repo.ts,
  including field comments) and add
  `export interface Expense extends ExpenseInput { id: string }`.
- `src/lib/repo.ts`: delete the local declaration; import `ExpenseInput`
  from `./types` and keep compatibility with
  `export type { ExpenseInput } from "./types";`
- Replace local re-declarations with `import type { Expense } from "../lib/types"`
  (adjust path depth): `QuickAdd.tsx`, `EditExpenseDialog.tsx`,
  `settings/ExportData.tsx` (each currently declares
  `interface Expense extends ExpenseInput { id: string }`).
- `dashboard/CategoryBars.tsx`: delete `DashExpense`; use `Expense`.
  Update its importers (`Dashboard.tsx`, `SpendingCalendar.tsx`) — with the
  real type, `SpendingCalendar`'s `expense={{ ...editing, note: editing.note ?? "" }}`
  coercion becomes just `expense={editing}` (note is required on
  ExpenseInput — verify after the swap; Dashboard's `useCollection` generic
  becomes `Expense`).
- `ThisMonth.tsx` line ~33: the inline `useCollection<{...}>` generic (which
  silently omits `paidWithDebtId`!) becomes `useCollection<Expense>`.
- `src/lib/savings.ts`: export its `SavingsExpense` type; define it as
  `Pick<Expense, "id" | "amount" | "date" | "note" | "category" | "fundedBySavings">`
  BUT check the current field optionality first — the Pick must not change
  what the functions require. If `Pick` fights the existing optional
  markers, keep the literal shape but EXPORT it.
- `dashboard/SavingsHistory.tsx`: delete its verbatim `SavingsExpense`
  re-declaration; import from `../../lib/savings`.
- `src/lib/selectors.ts` `ExpenseLike` stays (narrow structural input type,
  single definition — fine).

## 2. `lib/paidFrom.ts` — funding-token codec (+ tests)

New `src/lib/paidFrom.ts`:

```ts
import type { ExpenseInput } from "./types";

/** UI token for an expense's funding source: "" = unplanned, "@savings",
 *  "@group:X", "@debt:ID", or a bare month-line id. */
export function encodePaidFrom(
  e: Pick<ExpenseInput, "fundedBySavings" | "budgetGroup" | "paidWithDebtId" | "envelopeLineId">,
): string {
  return e.fundedBySavings ? "@savings"
    : e.budgetGroup ? `@group:${e.budgetGroup}`
    : e.paidWithDebtId ? `@debt:${e.paidWithDebtId}`
    : (e.envelopeLineId ?? "");
}

/** Funding fields implied by a token — exactly one set (or none, unplanned). */
export function decodePaidFrom(token: string): Partial<ExpenseInput> {
  if (token === "@savings") return { fundedBySavings: true };
  if (token.startsWith("@group:")) return { budgetGroup: token.slice(7) };
  if (token.startsWith("@debt:")) return { paidWithDebtId: token.slice(6) };
  return token ? { envelopeLineId: token } : {};
}

/** Patch form for updateExpense: the chosen field set, every other cleared. */
export function decodePaidFromPatch(token: string): {
  fundedBySavings: boolean | null; budgetGroup: string | null;
  paidWithDebtId: string | null; envelopeLineId: string | null;
} {
  return {
    fundedBySavings: token === "@savings" ? true : null,
    budgetGroup: token.startsWith("@group:") ? token.slice(7) : null,
    paidWithDebtId: token.startsWith("@debt:") ? token.slice(6) : null,
    envelopeLineId: token && !token.startsWith("@") ? token : null,
  };
}
```

Tests `src/lib/paidFrom.test.ts`: round-trip every variant
(`decodePaidFrom(encodePaidFrom(x))` recovers the field), patch form nulls
the non-chosen fields, "" → `{}` / all-null patch.

Use the codec at the four duplicated sites:
- `QuickAdd.tsx` `save()` spread → `...decodePaidFrom(activeEnvelope)`.
- `EditExpenseDialog.tsx` initial state + `was` → `encodePaidFrom(expense)`;
  the `if (envelope !== was)` block body → `Object.assign(patch, decodePaidFromPatch(envelope));`

## 3. `PaidFromPicker` component

New `src/components/PaidFromPicker.tsx` extracting the byte-identical chip
row from QuickAdd (Paid-from section) and EditExpenseDialog:

```tsx
export default function PaidFromPicker(
  { value, onPick, groups, envelopes, debts }:
  { value: string; onPick: (token: string) => void; groups: string[];
    envelopes: MonthLine[]; debts: Debt[] },
)
```

Renders exactly the current chips (Unplanned, group chips, envelope chips,
Savings, 💳 debt chips) with the current class strings, highlighting
`value`. Both call sites replace their chip-row `<div className="flex flex-wrap gap-2">…</div>`
with `<PaidFromPicker value={…} onPick={…} groups={groups} envelopes={envelopes} debts={activeDebts|debts} />`
(QuickAdd keeps its `pickEnvelope` persistence wrapper as `onPick`; the
dialog passes `setEnvelope`). Keep the surrounding `<Label>`/`<p>` headers
at the call sites.

## 4. Pure `expenseDeltas` (+ tests)

New `src/lib/expenseDeltas.ts` — extract updateExpense's inline arithmetic
(repo.ts, the savings-delta + debt-delta block) verbatim into:

```ts
import type { ExpenseInput } from "./types";

export interface ExpenseDeltas {
  savingsDelta: number; // increment for meta.savingsBalance (positive → give back)
  debtOps: { debtId: string; delta: number }[]; // increments for debts/{id}.currentBalance
}

/** Bookkeeping deltas implied by patching an expense. Pure. */
export function expenseDeltas(
  old: ExpenseInput,
  patch: { amount?: number; fundedBySavings?: boolean | null; paidWithDebtId?: string | null },
): ExpenseDeltas {
  const wasFunded = !!old.fundedBySavings;
  const nowFunded = patch.fundedBySavings === undefined ? wasFunded : patch.fundedBySavings === true;
  const newAmount = patch.amount ?? old.amount;
  const savingsDelta = (wasFunded ? old.amount : 0) - (nowFunded ? newAmount : 0);

  const oldDebtId = old.paidWithDebtId;
  const newDebtId = patch.paidWithDebtId === undefined ? oldDebtId : (patch.paidWithDebtId ?? undefined);
  const debtOps: { debtId: string; delta: number }[] = [];
  if (oldDebtId === newDebtId) {
    if (oldDebtId && newAmount !== old.amount) debtOps.push({ debtId: oldDebtId, delta: newAmount - old.amount });
  } else {
    if (oldDebtId) debtOps.push({ debtId: oldDebtId, delta: -old.amount });
    if (newDebtId) debtOps.push({ debtId: newDebtId, delta: newAmount });
  }
  return { savingsDelta, debtOps };
}
```

`updateExpense` calls it and applies: `if (deltas.savingsDelta !== 0) …increment(deltas.savingsDelta)`;
loop `deltas.debtOps` with the existing missing-debt guard. Behavior must
be identical — compare carefully against the current inline block.

Tests `src/lib/expenseDeltas.test.ts`: amount edit on savings-funded;
savings→none; none→savings; card amount edit; card A→card B; card→savings;
savings→card; card→none; none→card; no-op patch → zero deltas.

## 5. `ThisMonth` split

Extract the cutoff `map` body into `src/components/CutoffSection.tsx` — a
1:1 JSX move, all data via props (cutoff, lines, skippedLines, incomes,
expenses, debts, payments, cycleMins, cycleMinsGross, received, viewedKey,
currentKey, mode, editable, projected, template, events, lineSort,
collapsed state + toggle, busyIncome state + setter, and the dialog-opening
callbacks). Also extract the income `<li>` into an `IncomeRow` inside the
same file if it helps clarity. NO behavior/markup changes — this is a pure
move; the typechecker is the safety net. ThisMonth keeps: hooks, derived
values, header, action row, sort row, the map (now
`<CutoffSection …/>` per cutoff), and the dialogs.

## 6. Dead code (verified unused)

- `src/lib/selectors.ts`: delete `fundStateFor` + `FundState` (only used in
  selectors.test.ts — delete those tests too).
- `src/lib/channels.ts`: delete `isBuiltinChannel` (zero refs) and
  `channelChip` (app uses `channelChipSafe`); update channels.test.ts to
  drop/retarget the affected tests.
- `src/lib/repo.ts` `writeMonth`: stop writing the `incomes: [...]` array
  on the month meta doc (nothing reads it) — the meta set becomes
  `{ startedAt: localIso() }`; drop the now-unused `incomes` parameter ONLY
  if the ripple is small (startMonth passes it) — otherwise keep the param
  and just don't write the field, noting which you chose.

## NOT in scope

- `LineStatus` narrowing (seeded/legacy docs may carry the extra statuses).
- Un-exporting internals; month-name array dedup; DebtCard extraction.
