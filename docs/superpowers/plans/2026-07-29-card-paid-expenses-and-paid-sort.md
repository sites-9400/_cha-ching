# Card-Paid Expenses + Paid-First Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expenses can be paid with a credit card (or any active debt), atomically growing that debt's balance while skipping all cash/envelope math; plus a "Paid first" month-line sort option.

**Architecture:** New optional `paidWithDebtId` on `ExpenseInput`, mirroring the existing `fundedBySavings` pattern end-to-end: batched `increment()` on `debts/{id}.currentBalance` in repo.ts, an early-`continue` in `unplannedForCutoff`, and a `@debt:{id}` sentinel in the existing "Paid from" chip rows. The sort is a fifth pure comparator in `lineSort.ts`.

**Tech Stack:** React + TypeScript + Firebase Firestore (writeBatch/increment/deleteField), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-card-paid-expenses-and-paid-sort-design.md`

## Global Constraints

- **Do NOT run any commands** — no npm, npx, vitest, tsc, or git. The project lives on a Dropbox mount where parallel tooling hangs. Write code and tests only; the orchestrator runs verification (`npx tsc --noEmit`, `npx vitest run --no-file-parallelism`, `npx vite build`) and makes all commits.
- Match existing style exactly: 2-space indent, double quotes, semicolons, `type`-only imports where the file already does that.
- `paidWithDebtId`, `fundedBySavings`, `envelopeLineId`, `budgetGroup` are mutually exclusive on an expense; the single-choice "Paid from" row enforces this in the UI, and `save()` mappings must only ever set one.
- Dark mode: do NOT add anything to `src/index.css`. The new chips/badges use `bg-violet-600` / `text-violet-700`, which (like the existing savings `bg-cyan-600` / `text-cyan-700`) deliberately have no `.dark` override.

---

### Task 1: "Paid first" line sort

**Files:**
- Modify: `src/lib/lineSort.ts` (whole file is 21 lines)
- Test: `src/lib/lineSort.test.ts` (create — none exists)

**Interfaces:**
- Consumes: `LineStatus` from `./types` (`"" | "PAID" | "RECEIVED" | "TRANSFERRED" | "SENT"`).
- Produces: `LineSortKey` gains `"paid"`; `lineComparators.paid`; `LINE_SORTS` gains `{ key: "paid", label: "Paid first" }`. `ThisMonth.tsx` consumes these automatically (chip row renders from `LINE_SORTS`, month lines already carry `status`) — no changes there.

- [ ] **Step 1: Write the failing test**

Create `src/lib/lineSort.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lineComparators, LINE_SORTS } from "./lineSort";
import type { LineStatus } from "./types";

const line = (name: string, order: number, status: LineStatus) =>
  ({ name, amount: 100, channel: "CASH" as const, order, status });

describe("paid-first sort", () => {
  it("puts ticked lines above unticked ones", () => {
    const rows = [line("a", 0, ""), line("b", 1, "PAID"), line("c", 2, "")];
    expect(rows.sort(lineComparators.paid).map((l) => l.name)).toEqual(["b", "a", "c"]);
  });

  it("treats every non-empty status as ticked", () => {
    const rows = [line("a", 0, ""), line("b", 1, "SENT"), line("c", 2, "RECEIVED"), line("d", 3, "TRANSFERRED")];
    expect(rows.sort(lineComparators.paid).map((l) => l.name)).toEqual(["b", "c", "d", "a"]);
  });

  it("keeps manual order within each group", () => {
    const rows = [line("late", 5, "PAID"), line("early", 1, "PAID"), line("u2", 4, ""), line("u1", 2, "")];
    expect(rows.sort(lineComparators.paid).map((l) => l.name)).toEqual(["early", "late", "u1", "u2"]);
  });

  it("is offered as a sort option", () => {
    expect(LINE_SORTS.map((s) => s.key)).toContain("paid");
  });
});
```

- [ ] **Step 2: Implement**

Replace `src/lib/lineSort.ts` content with:

```ts
import type { Channel, LineStatus } from "./types";

export type LineSortKey = "order" | "amount" | "channel" | "name" | "paid";

interface Sortable { name: string; amount: number; channel: Channel; order: number; status: LineStatus }

/** Comparators for sorting expense lines within a cutoff. Pure. */
export const lineComparators: Record<LineSortKey, (a: Sortable, b: Sortable) => number> = {
  order: (a, b) => a.order - b.order,
  amount: (a, b) => b.amount - a.amount, // biggest first
  channel: (a, b) => String(a.channel).localeCompare(String(b.channel)) || (a.order - b.order),
  name: (a, b) => a.name.localeCompare(b.name),
  paid: (a, b) => Number(b.status !== "") - Number(a.status !== "") || (a.order - b.order),
};

export const LINE_SORTS: { key: LineSortKey; label: string }[] = [
  { key: "order", label: "Default" },
  { key: "amount", label: "Amount" },
  { key: "channel", label: "Channel" },
  { key: "name", label: "Name" },
  { key: "paid", label: "Paid first" },
];
```

Note `Sortable` gaining `status` is safe: the only sort call site is `ThisMonth.tsx:126`, which sorts `MonthLine[]` — `MonthLine` has `status`. Do not touch `ThisMonth.tsx`.

---

### Task 2: `unplannedForCutoff` skips card-paid expenses

**Files:**
- Modify: `src/lib/selectors.ts:58-60` (ExpenseLike) and `:121` (skip)
- Test: `src/lib/selectors.test.ts` (append one test in the existing `describe` that holds the savings test at line 232)

**Interfaces:**
- Produces: `ExpenseLike` gains `paidWithDebtId?: string`. Callers pass richer objects structurally, so component call sites need no changes.

- [ ] **Step 1: Write the failing test**

In `src/lib/selectors.test.ts`, directly after the existing test `"excludes savings-funded expenses from free cash entirely"` (ends line 236), add:

```ts
  it("excludes card-paid expenses from free cash entirely", () => {
    const expenses = [{ amount: 5000, date: "2026-07-15T10:00:00.000Z", paidWithDebtId: "rcbc" }];
    expect(unplannedForCutoff(expenses, "2026-07", 1, openLines)).toBe(0);
    expect(unplannedForCutoff(expenses, "2026-07", 2, openLines)).toBe(0);
  });
```

- [ ] **Step 2: Implement**

In `src/lib/selectors.ts`, change `ExpenseLike` to:

```ts
type ExpenseLike = {
  amount: number; date: string; envelopeLineId?: string; fundedBySavings?: boolean; budgetGroup?: string;
  paidWithDebtId?: string;
};
```

and in `unplannedForCutoff`, directly under the existing line
`if (e.fundedBySavings) continue; // paid from savings — never touches cutoff cash` add:

```ts
    if (e.paidWithDebtId) continue; // charged to a card — debt grew instead; cash leaves when the bill is paid
```

Also extend the function's doc comment sentence "Savings-funded expenses never touch cutoff cash." to "Savings-funded and card-paid expenses never touch cutoff cash."

---

### Task 3: Repo layer — `paidWithDebtId` writes

**Files:**
- Modify: `src/lib/repo.ts:120-177` (`ExpenseInput`, `addExpense`, `deleteExpense`, `updateExpense`)

**Interfaces:**
- Consumes: `debtsCol` from `./paths` (already imported — used at repo.ts:200).
- Produces: `ExpenseInput.paidWithDebtId?: string`; `updateExpense`'s patch type gains `paidWithDebtId?: string | null` (null clears via `deleteField()`). Tasks 4-6 rely on exactly these names.

No unit tests: the repo layer is untested Firestore batch code throughout (there is no repo.test.ts); the orchestrator reviews this task against the tested savings-delta pattern it mirrors.

- [ ] **Step 1: Extend `ExpenseInput`**

```ts
export interface ExpenseInput {
  amount: number; category: string; channel: string; note: string; date: string;
  envelopeLineId?: string; // month line the spending draws from; absent = unplanned
  fundedBySavings?: boolean; // paid from savings — skips cutoff math, deducts savingsBalance
  budgetGroup?: string; // budget-group pool the spending draws from (e.g. "Allowance")
  paidWithDebtId?: string; // charged to this debt — skips cutoff math, grows currentBalance
}
```

- [ ] **Step 2: `addExpense`**

```ts
export async function addExpense(e: ExpenseInput): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, expensesCol())), e);
  if (e.fundedBySavings) batch.update(doc(db, metaDoc()), { savingsBalance: increment(-e.amount) });
  if (e.paidWithDebtId) batch.update(doc(db, debtsCol(), e.paidWithDebtId), { currentBalance: increment(e.amount) });
  await batch.commit();
}
```

- [ ] **Step 3: `deleteExpense`**

A batched `update` against a missing doc fails the whole batch, so the reversal must confirm the debt still exists:

```ts
export async function deleteExpense(id: string): Promise<void> {
  const ref = doc(db, expensesCol(), id);
  const snap = await getDoc(ref);
  const batch = writeBatch(db);
  batch.delete(ref);
  if (snap.exists() && snap.data().fundedBySavings) {
    batch.update(doc(db, metaDoc()), { savingsBalance: increment(snap.data().amount as number) });
  }
  const debtId = snap.exists() ? (snap.data().paidWithDebtId as string | undefined) : undefined;
  if (debtId) {
    const debtRef = doc(db, debtsCol(), debtId);
    if ((await getDoc(debtRef)).exists()) {
      batch.update(debtRef, { currentBalance: increment(-(snap.data()!.amount as number)) });
    }
  }
  await batch.commit();
}
```

- [ ] **Step 4: `updateExpense`**

Extend the signature's patch type (both the `Omit` list and the nullable additions) and add the debt delta beside the savings delta. Full replacement:

```ts
/** Patch a logged expense. `envelopeLineId`/`fundedBySavings: null` removes the
 *  field via deleteField() — Firestore rejects literal undefined. Savings-funded
 *  changes (amount edits, toggling the source) adjust savingsBalance by the delta;
 *  card-paid changes adjust the affected debt balances the same way. */
export async function updateExpense(
  id: string,
  patch: Partial<Omit<ExpenseInput, "envelopeLineId" | "fundedBySavings" | "budgetGroup" | "paidWithDebtId">>
    & { envelopeLineId?: string | null; fundedBySavings?: boolean | null; budgetGroup?: string | null;
        paidWithDebtId?: string | null },
): Promise<void> {
  const ref = doc(db, expensesCol(), id);
  const snap = await getDoc(ref);
  const old = (snap.data() ?? {}) as ExpenseInput;

  const { envelopeLineId, fundedBySavings, budgetGroup, paidWithDebtId, ...rest } = patch;
  const data: UpdateData<ExpenseInput> = { ...rest };
  if (envelopeLineId === null) data.envelopeLineId = deleteField();
  else if (envelopeLineId !== undefined) data.envelopeLineId = envelopeLineId;
  if (fundedBySavings === null || fundedBySavings === false) data.fundedBySavings = deleteField();
  else if (fundedBySavings === true) data.fundedBySavings = true;
  if (budgetGroup === null) data.budgetGroup = deleteField();
  else if (budgetGroup !== undefined) data.budgetGroup = budgetGroup;
  if (paidWithDebtId === null) data.paidWithDebtId = deleteField();
  else if (paidWithDebtId !== undefined) data.paidWithDebtId = paidWithDebtId;

  // Savings delta: what the old doc deducted vs what the new state should deduct.
  const wasFunded = !!old.fundedBySavings;
  const nowFunded = fundedBySavings === undefined ? wasFunded : fundedBySavings === true;
  const oldDeduct = wasFunded ? old.amount : 0;
  const newDeduct = nowFunded ? (patch.amount ?? old.amount) : 0;
  const delta = oldDeduct - newDeduct; // positive → give back to savings

  // Debt delta: reverse what the old doc charged, apply what the new state charges.
  const oldDebtId = old.paidWithDebtId;
  const newDebtId = paidWithDebtId === undefined ? oldDebtId : (paidWithDebtId ?? undefined);
  const newAmount = patch.amount ?? old.amount;
  const debtOps: { debtId: string; delta: number }[] = [];
  if (oldDebtId === newDebtId) {
    if (oldDebtId && newAmount !== old.amount) debtOps.push({ debtId: oldDebtId, delta: newAmount - old.amount });
  } else {
    if (oldDebtId) debtOps.push({ debtId: oldDebtId, delta: -old.amount });
    if (newDebtId) debtOps.push({ debtId: newDebtId, delta: newAmount });
  }

  const batch = writeBatch(db);
  batch.update(ref, data);
  if (delta !== 0) batch.update(doc(db, metaDoc()), { savingsBalance: increment(delta) });
  for (const op of debtOps) {
    const debtRef = doc(db, debtsCol(), op.debtId);
    if ((await getDoc(debtRef)).exists()) batch.update(debtRef, { currentBalance: increment(op.delta) });
  }
  await batch.commit();
}
```

Covered cases: card→card (same debt, amount edit → single delta), card A→card B (reverse A, charge B), card→savings / savings→card (each side's own delta logic fires), card→none (reverse only), none→card (charge only), missing debt (op silently skipped).

---

### Task 4: Quick Add — card chips + recent-row badge

**Files:**
- Modify: `src/components/QuickAdd.tsx`

**Interfaces:**
- Consumes: `paidWithDebtId` from Task 3; `Debt` type from `../lib/types`; `debtsCol` from `../lib/paths`.
- Produces: sentinel convention `@debt:{debtId}` stored in the shared `localStorage["quickadd-envelope"]`; Task 5 uses the same sentinel.

- [ ] **Step 1: Load debts**

Add `debtsCol` to the existing paths import (line 5) and `Debt` to the types import (line 8):

```ts
import { categoriesCol, debtsCol, expensesCol, monthLines } from "../lib/paths";
import type { Category, Channel, Debt, MonthLine } from "../lib/types";
```

Below the `allLines` hook (line 20-21 area), add:

```ts
  const debts = useCollection<Debt>(debtsCol());
  const activeDebts = debts.filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
```

- [ ] **Step 2: Validate the remembered sentinel**

Replace the `activeEnvelope` computation (lines 34-40) with:

```ts
  // "@savings" = Savings; "@group:X" = budget group X; "@debt:ID" = charged to
  // that debt. A remembered source that no longer exists (new month, deleted
  // line, deactivated debt) falls back to Unplanned.
  const activeEnvelope =
    envelope === "@savings"
    || (envelope.startsWith("@group:") && groups.includes(envelope.slice(7)))
    || (envelope.startsWith("@debt:") && activeDebts.some((d) => d.id === envelope.slice(6)))
    || envelopes.some((l) => l.id === envelope)
      ? envelope : "";
```

- [ ] **Step 3: Map the sentinel in `save()`**

Replace the spread inside `addExpense` (lines 61-65) with:

```ts
        ...(activeEnvelope === "@savings"
          ? { fundedBySavings: true }
          : activeEnvelope.startsWith("@group:")
            ? { budgetGroup: activeEnvelope.slice(7) }
            : activeEnvelope.startsWith("@debt:")
              ? { paidWithDebtId: activeEnvelope.slice(6) }
              : activeEnvelope ? { envelopeLineId: activeEnvelope } : {}),
```

- [ ] **Step 4: Card chips in the "Paid from" row**

Directly after the Savings button (closes at line 153), add:

```tsx
            {activeDebts.map((d) => (
              <button
                key={d.id} onClick={() => pickEnvelope(`@debt:${d.id}`)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  activeEnvelope === `@debt:${d.id}` ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >💳 {d.name}</button>
            ))}
```

- [ ] **Step 5: Badge in the Recent list**

After the `{e.fundedBySavings && ...}` badge (line 184), add:

```tsx
                    {e.paidWithDebtId && (
                      <span className="text-violet-700"> · 💳 {debts.find((d) => d.id === e.paidWithDebtId)?.name ?? "card"}</span>
                    )}
```

- [ ] **Step 6: Pass debts to the edit dialog**

The `EditExpenseDialog` call at lines 199-204 gains a `debts={activeDebts}` prop (Task 5 adds the prop to the dialog):

```tsx
        <EditExpenseDialog
          expense={editing} categories={cats} lines={lines} debts={activeDebts}
          onClose={() => setEditing(null)}
        />
```

---

### Task 5: EditExpenseDialog — card option + call sites

**Files:**
- Modify: `src/components/EditExpenseDialog.tsx`
- Modify: `src/components/dashboard/SpendingCalendar.tsx` (second call site)

**Interfaces:**
- Consumes: `@debt:{id}` sentinel (Task 4), `updateExpense` patch with `paidWithDebtId?: string | null` (Task 3).
- Produces: new required prop `debts: Debt[]` on `EditExpenseDialog`.

- [ ] **Step 1: Prop + initial state**

Add `Debt` to the types import (line 3), add `debts` to the props (lines 10-13):

```ts
import type { Category, Channel, Debt, MonthLine } from "../lib/types";
```

```ts
export default function EditExpenseDialog(
  { expense, categories, lines, debts, onClose }:
  { expense: Expense; categories: Category[]; lines: MonthLine[]; debts: Debt[]; onClose: () => void },
) {
```

Extend the initial `envelope` state (lines 18-23):

```ts
  // "@savings" = paid from savings; "@group:X" = budget group X; "@debt:ID" = charged to that debt.
  const [envelope, setEnvelope] = useState(
    expense.fundedBySavings ? "@savings"
    : expense.budgetGroup ? `@group:${expense.budgetGroup}`
    : expense.paidWithDebtId ? `@debt:${expense.paidWithDebtId}`
    : (expense.envelopeLineId ?? ""),
  );
```

- [ ] **Step 2: `save()` diff**

Replace the `was`/`if (envelope !== was)` block (lines 45-52) with:

```ts
    const was = expense.fundedBySavings ? "@savings"
      : expense.budgetGroup ? `@group:${expense.budgetGroup}`
      : expense.paidWithDebtId ? `@debt:${expense.paidWithDebtId}`
      : (expense.envelopeLineId ?? "");
    if (envelope !== was) {
      patch.fundedBySavings = envelope === "@savings" ? true : null;
      patch.budgetGroup = envelope.startsWith("@group:") ? envelope.slice(7) : null;
      patch.paidWithDebtId = envelope.startsWith("@debt:") ? envelope.slice(6) : null;
      patch.envelopeLineId = envelope && !envelope.startsWith("@") ? envelope : null;
    }
```

- [ ] **Step 3: Card chips**

After the Savings button (closes at line 125), add:

```tsx
            {debts.map((d) => (
              <button
                key={d.id} onClick={() => setEnvelope(`@debt:${d.id}`)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  envelope === `@debt:${d.id}` ? "bg-violet-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >💳 {d.name}</button>
            ))}
```

- [ ] **Step 4: SpendingCalendar call site**

In `src/components/dashboard/SpendingCalendar.tsx`: add imports for `Debt` (types) and `debtsCol` (paths) following the file's existing import style, load

```ts
  const debts = useCollection<Debt>(debtsCol());
  const activeDebts = debts.filter((d) => d.active).sort((a, b) => a.payoffOrder - b.payoffOrder);
```

next to the existing `useCollection` hooks (lines 31-32), and pass `debts={activeDebts}` to the `<EditExpenseDialog` at line 102.

---

### Task 6: Expenses CSV — "Paid with" column

**Files:**
- Modify: `src/components/settings/ExportData.tsx:20-27`

**Interfaces:**
- Consumes: `debts` already loaded in this component (line 14); `paidWithDebtId` from Task 3.

- [ ] **Step 1: Add the column**

Replace the Expenses export entry with:

```tsx
    {
      label: "Expenses", file: "expenses.csv",
      run: () => downloadCsv("expenses.csv", toCsv(
        expenses.map((e) => ({
          ...e,
          paidWith: e.paidWithDebtId ? (debts.find((d) => d.id === e.paidWithDebtId)?.name ?? e.paidWithDebtId) : "",
        })),
        [
          { key: "date", label: "Date" }, { key: "amount", label: "Amount" },
          { key: "category", label: "Category" }, { key: "channel", label: "Channel" },
          { key: "note", label: "Note" }, { key: "paidWith", label: "Paid with" },
        ] as Column<Expense & { paidWith: string }>[],
      )),
    },
```

`monthExport.ts` is deliberately untouched (no payment docs are written, so no export rows can double-count).

---

### Task 7: Orchestrator verification (not for the subagent)

- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run --no-file-parallelism` — full suite green including the new `lineSort` and `selectors` tests
- [ ] `npx vite build`
- [ ] Diff review against spec, then commit and push to main (deploy pre-authorized this session); confirm the GitHub Actions deploy succeeds
