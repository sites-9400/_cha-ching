# Savings Deposits & Income Routed to Savings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let money be added to savings with a recorded history, and let an income source be routed straight to savings.

**Architecture:** A new `savingsMoves` collection records every deliberate movement; each write batches the document with an `increment` on `meta.savingsBalance`, so the balance and its history cannot drift apart. The Recent list is a pure merge of those moves with the `fundedBySavings` expenses that already exist, so the delicate `updateExpense` delta path is untouched. Income routing is derived, not stored: `cutoffSummary` counts a `toSavings` income in both `income` and `planned`.

**Tech Stack:** React 18 + TypeScript (strict), Vite, Vitest, Firebase Firestore v11, Tailwind v4.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-savings-deposits-design.md`.
- Pure logic goes in `src/lib/*.ts` with a colocated `*.test.ts`; components never contain money math.
- TypeScript is strict — no `any`, no non-null assertions.
- **This repo is on a Dropbox CloudStorage mount. Implementers must NOT run `npm`, `npx`, `vitest`, `tsc`, or `npm run build` — those commands stall for 20+ minutes here. The controller runs all verification.** Use Read/Edit tools for file work.
- **Implementers must NOT run any git command.** The controller owns version control.
- A `SavingsMove.amount` is ALWAYS positive; `direction` carries the sign. Never store a negative amount.
- Every write that changes `meta.savingsBalance` must batch the balance `increment` together with its history document. Never write one without the other.

---

### Task 1: Types, paths, and the pure helpers

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/paths.ts`
- Create: `src/lib/savings.ts`
- Create: `src/lib/savings.test.ts`
- Modify: `src/lib/selectors.ts` (`cutoffSummary` only)
- Modify: `src/lib/selectors.test.ts` (append)

**Interfaces:**
- Produces, for Tasks 2 and 3:
  - `SavingsMove` and `Income.toSavings?: boolean` in `./types`
  - `savingsMovesCol(): string` in `./paths`
  - `SavingsEntry` and `savingsHistory(moves, expenses, limit?)` in `./savings`
  - `cutoffSummary(lines, incomes, cutoff, received?)` in `./selectors`

- [ ] **Step 1: Types**

In `src/lib/types.ts`, add `toSavings` to `Income`:

```ts
export interface Income {
  id: string;
  name: string;
  amount: number;
  day: number; // 13 | 25 | 29
  cutoff: 1 | 2;
  toSavings?: boolean; // received money goes to savings, not spendable cash
}
```

And add a new interface directly after `SinkingFund`:

```ts
/** One deliberate movement of savings. `amount` is always positive; `direction`
 *  carries the sign. Written together with the balance increment, so the balance
 *  always has a history that explains it. */
export interface SavingsMove {
  id: string;
  amount: number;
  direction: "in" | "out";
  source: string;    // free text — "Side gig", "Correction", an income's name
  date: string;      // ISO
  incomeId?: string; // set when created by ticking a toSavings income…
  monthKey?: string; // …together these locate the move to reverse on untick
}
```

- [ ] **Step 2: Path helper**

In `src/lib/paths.ts`, beside the other `col(...)` helpers:

```ts
export const savingsMovesCol = (): string => col("savingsMoves");
```

- [ ] **Step 3: Write the failing tests for `savingsHistory`**

Create `src/lib/savings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { savingsHistory } from "./savings";
import type { SavingsMove } from "./types";

const MV = (o: Partial<SavingsMove>): SavingsMove =>
  ({ id: "m", amount: 1000, direction: "in", source: "Side gig", date: "2026-07-20T00:00:00.000Z", ...o });
const EX = (o: Partial<{ id: string; amount: number; date: string; note?: string; category?: string; fundedBySavings?: boolean }>) =>
  ({ id: "e", amount: 500, date: "2026-07-21T00:00:00.000Z", fundedBySavings: true, ...o });

describe("savingsHistory", () => {
  it("merges moves and savings-funded expenses into one list", () => {
    const rows = savingsHistory([MV({ id: "m1" })], [EX({ id: "e1", note: "Laptop repair" })]);
    expect(rows.map((r) => r.id)).toEqual(["e1", "m1"]); // e1 is the later date
    expect(rows.map((r) => r.kind)).toEqual(["expense", "move"]);
  });

  it("sorts by date descending", () => {
    const rows = savingsHistory(
      [MV({ id: "old", date: "2026-07-01T00:00:00.000Z" }), MV({ id: "new", date: "2026-07-25T00:00:00.000Z" })],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("caps at the limit, defaulting to 8", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      MV({ id: `m${i}`, date: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` }));
    expect(savingsHistory(many, [])).toHaveLength(8);
    expect(savingsHistory(many, [], 3)).toHaveLength(3);
  });

  it("ignores expenses not funded by savings", () => {
    expect(savingsHistory([], [EX({ id: "e1", fundedBySavings: false })])).toEqual([]);
    expect(savingsHistory([], [EX({ id: "e2", fundedBySavings: undefined })])).toEqual([]);
  });

  it("takes an expense's source from note, then category, then a fallback", () => {
    const [a] = savingsHistory([], [EX({ note: "Laptop repair", category: "Tech" })]);
    expect(a.source).toBe("Laptop repair");
    const [b] = savingsHistory([], [EX({ category: "Tech" })]);
    expect(b.source).toBe("Tech");
    const [c] = savingsHistory([], [EX({})]);
    expect(c.source).toBe("Expense");
  });

  it("always marks expense entries as outgoing and read-only in kind", () => {
    const [e] = savingsHistory([], [EX({ amount: 3200 })]);
    expect(e).toMatchObject({ amount: 3200, direction: "out", kind: "expense" });
  });
});
```

- [ ] **Step 4: Write `savingsHistory`**

Create `src/lib/savings.ts`:

```ts
import type { SavingsMove } from "./types";

export interface SavingsEntry {
  id: string;
  date: string;
  amount: number;            // always positive
  direction: "in" | "out";
  source: string;
  kind: "move" | "expense";  // expense rows are read-only in the UI
}

interface SavingsExpense {
  id: string;
  amount: number;
  date: string;
  note?: string;
  category?: string;
  fundedBySavings?: boolean;
}

/** The savings ledger: deliberate moves merged with the expenses already funded
 *  from savings, newest first. Expenses are read, never written, so the delta
 *  handling in `updateExpense` stays the single source of truth for them. Pure. */
export function savingsHistory(
  moves: readonly SavingsMove[],
  expenses: readonly SavingsExpense[],
  limit = 8,
): SavingsEntry[] {
  const fromMoves: SavingsEntry[] = moves.map((m) => ({
    id: m.id, date: m.date, amount: m.amount, direction: m.direction,
    source: m.source, kind: "move",
  }));

  const fromExpenses: SavingsEntry[] = expenses
    .filter((e) => e.fundedBySavings)
    .map((e) => ({
      id: e.id, date: e.date, amount: e.amount, direction: "out",
      source: e.note?.trim() || e.category?.trim() || "Expense",
      kind: "expense",
    }));

  return [...fromMoves, ...fromExpenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
```

- [ ] **Step 5: Write the failing tests for `cutoffSummary`**

Append to `src/lib/selectors.test.ts`. Reuse the fixture helpers already at the top of that file for lines; build incomes as plain objects matching the `Income` shape:

```ts
describe("cutoffSummary with income routed to savings", () => {
  const incomes = [
    { id: "sal", name: "Salary", amount: 25000, day: 13, cutoff: 1 as const },
    { id: "gig", name: "Side gig", amount: 5000, day: 20, cutoff: 1 as const, toSavings: true },
  ];

  it("counts a toSavings income in both income and planned, leaving surplus unchanged", () => {
    const withFlag = cutoffSummary([], incomes, 1);
    expect(withFlag.income).toBe(30000);
    expect(withFlag.planned).toBe(5000);
    expect(withFlag.surplus).toBe(25000);

    const withoutGig = cutoffSummary([], [incomes[0]], 1);
    expect(withFlag.surplus).toBe(withoutGig.surplus);
  });

  it("counts a received toSavings income in ticked so the bar can reach 100%", () => {
    expect(cutoffSummary([], incomes, 1, { gig: true }).ticked).toBe(5000);
    expect(cutoffSummary([], incomes, 1, { gig: false }).ticked).toBe(0);
    expect(cutoffSummary([], incomes, 1).ticked).toBe(0);
  });

  it("leaves a normal income untouched by the received parameter", () => {
    const s = cutoffSummary([], [incomes[0]], 1, { sal: true });
    expect(s).toMatchObject({ income: 25000, planned: 0, ticked: 0, surplus: 25000 });
  });
});
```

- [ ] **Step 6: Update `cutoffSummary`**

In `src/lib/selectors.ts`, replace the existing `cutoffSummary` with:

```ts
/** A cutoff's money. An income flagged `toSavings` counts as income AND as
 *  planned — it arrives but is already spoken for, so surplus is unchanged;
 *  once received it also counts as ticked, so the progress bar can complete. */
export function cutoffSummary(
  lines: MonthLine[],
  incomes: Income[],
  cutoff: 1 | 2,
  received?: Record<string, boolean>,
): CutoffSummary {
  const inCut = <T extends { cutoff: 1 | 2 }>(xs: T[]): T[] => xs.filter((x) => x.cutoff === cutoff);
  const cutIncomes = inCut(incomes);
  const income = cutIncomes.reduce((s, i) => s + i.amount, 0);
  const swept = cutIncomes.filter((i) => i.toSavings);
  const sweptTotal = swept.reduce((s, i) => s + i.amount, 0);
  const sweptReceived = swept
    .filter((i) => received?.[i.id] === true)
    .reduce((s, i) => s + i.amount, 0);
  const cutLines = inCut(lines);
  const planned = cutLines.reduce((s, l) => s + l.amount, 0) + sweptTotal;
  const ticked = cutLines.filter((l) => l.status !== "").reduce((s, l) => s + l.amount, 0) + sweptReceived;
  return { income, planned, ticked, surplus: income - planned };
}
```

The `received` parameter is optional, so the existing callers in
`src/lib/project.ts` (lines 41-42) keep compiling unchanged — projected months
have no received map, and a `toSavings` income still correctly reduces their
projected surplus via `planned`.

- [ ] **Step 7: Report**

Write your report and return. The controller runs verification.

---

### Task 2: Repo writes

**Files:**
- Modify: `src/lib/repo.ts`

**Interfaces:**
- Consumes: `SavingsMove`, `Income.toSavings`, `savingsMovesCol` from Task 1.
- Produces, for Task 3:
  - `addSavingsMove(move: Omit<SavingsMove, "id">): Promise<void>`
  - `deleteSavingsMove(move: SavingsMove): Promise<void>`
  - `setIncomeReceived(monthKey: string, income: Income, received: boolean): Promise<void>` — **signature changed**

**Background you need:**

`repo.ts` already imports `collection`, `doc`, `getDocs`, `increment`, `writeBatch`, `updateDoc`, `db`, `metaDoc`, `monthDoc`, and has a local `stripUndefined` helper near the top. Add `savingsMovesCol` to the existing import from `./paths`, and `SavingsMove` to the existing type import from `./types`. Add nothing else.

`setIncomeReceived` currently takes `incomeId` and writes one field. It now needs the whole `Income` because it must read `amount`, `name`, and `toSavings`. Its only caller is `ThisMonth.tsx:157`, which Task 3 updates.

- [ ] **Step 1: Add the two move functions**

In `src/lib/repo.ts`, directly after `updateMeta` (the "Patch the household meta" function around line 267), add:

```ts
/** Record a savings movement and move the balance in the same batch, so the
 *  balance can never drift from the history that explains it. */
export async function addSavingsMove(move: Omit<SavingsMove, "id">): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, savingsMovesCol())), stripUndefined(move));
  batch.update(doc(db, metaDoc()), {
    savingsBalance: increment(move.direction === "in" ? move.amount : -move.amount),
  });
  await batch.commit();
}

/** Undo a movement: delete it and reverse its effect on the balance. */
export async function deleteSavingsMove(move: SavingsMove): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, savingsMovesCol(), move.id));
  batch.update(doc(db, metaDoc()), {
    savingsBalance: increment(move.direction === "in" ? -move.amount : move.amount),
  });
  await batch.commit();
}
```

- [ ] **Step 2: Replace `setIncomeReceived`**

Replace the whole existing function (currently at `repo.ts:66-71`) with:

```ts
/** Tick/untick an income as RECEIVED for a month (stored on the month meta doc).
 *  An income flagged `toSavings` also moves the money: receiving credits the
 *  savings balance and records a move; unticking reverses both. Mirrors
 *  `toggleLinePaid`'s untick path — the move is located by incomeId + monthKey. */
export async function setIncomeReceived(
  monthKey: string, income: Income, received: boolean,
): Promise<void> {
  if (!income.toSavings) {
    await updateDoc(doc(db, monthDoc(monthKey)), { [`receivedIncomes.${income.id}`]: received });
    return;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, monthDoc(monthKey)), { [`receivedIncomes.${income.id}`]: received });

  if (received) {
    batch.set(doc(collection(db, savingsMovesCol())), {
      amount: income.amount, direction: "in", source: income.name,
      date: new Date().toISOString(), incomeId: income.id, monthKey,
    });
    batch.update(doc(db, metaDoc()), { savingsBalance: increment(income.amount) });
  } else {
    // Reverse only what was actually recorded — if the move was already deleted
    // by hand, the balance must not be decremented a second time.
    const snap = await getDocs(collection(db, savingsMovesCol()));
    for (const d of snap.docs) {
      const data = d.data();
      if (data.incomeId === income.id && data.monthKey === monthKey) {
        batch.delete(d.ref);
        batch.update(doc(db, metaDoc()), { savingsBalance: increment(-(data.amount as number)) });
      }
    }
  }

  await batch.commit();
}
```

- [ ] **Step 3: Report**

Write your report and return. In it, confirm which existing imports your code relies on and that you added none.

---

### Task 3: UI

**Files:**
- Create: `src/components/dashboard/SavingsMoveDialog.tsx`
- Create: `src/components/dashboard/SavingsHistory.tsx`
- Modify: `src/components/dashboard/SavingsMeter.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/settings/IncomesEditor.tsx`
- Modify: `src/components/AddOneOff.tsx`
- Modify: `src/components/ThisMonth.tsx`

**Interfaces:**
- Consumes: `savingsHistory`, `SavingsEntry` from `../../lib/savings`; `addSavingsMove`, `deleteSavingsMove`, `setIncomeReceived` from `../../lib/repo`; `savingsMovesCol` from `../../lib/paths`; `SavingsMove` from `../../lib/types`.
- Produces: nothing — final task.

- [ ] **Step 1: The move dialog**

Create `src/components/dashboard/SavingsMoveDialog.tsx`, following the styling of `src/components/AddOneOff.tsx` (read it first — same modal shell, same button classes):

```tsx
import { useState } from "react";
import { addSavingsMove } from "../../lib/repo";

export default function SavingsMoveDialog({ onClose }: { onClose: () => void }) {
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const amt = Number(amount);
  const valid = amt > 0 && source.trim() !== "";

  async function save() {
    if (!valid) return;
    await addSavingsMove({
      amount: amt, direction, source: source.trim(),
      date: new Date(`${date}T00:00:00`).toISOString(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Savings</h3>
        <div className="flex gap-2">
          {([["in", "Add"], ["out", "Withdraw"]] as const).map(([d, lbl]) => (
            <button key={d} onClick={() => setDirection(d)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${direction === d ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"}`}>
              {lbl}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between text-sm">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
        </label>
        <input placeholder="Source (e.g. Side gig)" value={source} onChange={(e) => setSource(e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
        <label className="flex items-center justify-between text-sm">Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border-b border-stone-300 outline-none" />
        </label>
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: The history list**

Create `src/components/dashboard/SavingsHistory.tsx`:

```tsx
import { useCollection } from "../../hooks/useCollection";
import { peso } from "../../lib/format";
import { savingsMovesCol } from "../../lib/paths";
import { deleteSavingsMove } from "../../lib/repo";
import { savingsHistory } from "../../lib/savings";
import type { SavingsMove } from "../../lib/types";

interface SavingsExpense {
  id: string; amount: number; date: string; note?: string; category?: string; fundedBySavings?: boolean;
}

export default function SavingsHistory({ expenses }: { expenses: readonly SavingsExpense[] }) {
  const moves = useCollection<SavingsMove>(savingsMovesCol());
  const byId = new Map(moves.map((m) => [m.id, m]));
  const rows = savingsHistory(moves, expenses);

  if (rows.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <h2 className="font-semibold text-sm mb-2">Recent</h2>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-stone-400 text-xs w-14 shrink-0 tabular-nums">{r.date.slice(5, 10)}</span>
            <span className="truncate flex-1">{r.source}</span>
            <span className={`tabular-nums shrink-0 ${r.direction === "in" ? "text-emerald-700" : "text-stone-500"}`}>
              {r.direction === "in" ? "+" : "−"}{peso(r.amount)}
            </span>
            {r.kind === "move" && (
              <button
                onClick={() => { const m = byId.get(r.id); if (m) void deleteSavingsMove(m); }}
                className="text-stone-300 text-xs pl-1"
              >✕</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: `SavingsMeter` — add button, and record corrections**

In `src/components/dashboard/SavingsMeter.tsx`, add an `onAdd` prop and a button, and change the manual edit to report a delta rather than an absolute. Replace the props and the `save` function:

```tsx
export default function SavingsMeter({
  balance, floor, onSave, onAdd,
}: { balance: number; floor: number; onSave: (v: number) => void | Promise<void>; onAdd: () => void }) {
```

Leave `save()` as it is — it still calls `onSave(v)` with the typed total; Dashboard converts that into a Correction move. Then add the button directly below the meter's closing `</p>` (the "above the floor" line), inside the `<section>`:

```tsx
      <button onClick={onAdd} className="mt-3 text-sm font-semibold text-emerald-700">+ Add to savings</button>
```

- [ ] **Step 4: Wire up `Dashboard`**

In `src/components/Dashboard.tsx`:

Add imports:

```ts
import { useState } from "react";
import { addSavingsMove } from "../lib/repo";
import SavingsHistory from "./dashboard/SavingsHistory";
import SavingsMoveDialog from "./dashboard/SavingsMoveDialog";
```

`updateMeta` is already imported — keep it, it is still used elsewhere in the file only if other calls exist; if `onSave` was its sole use, remove it from the import.

Add state inside the component:

```ts
  const [movingSavings, setMovingSavings] = useState(false);
```

Replace the `SavingsMeter` element and add the history below it:

```tsx
      <SavingsMeter
        balance={meta?.savingsBalance ?? 0}
        floor={meta?.savingsFloor ?? 100000}
        onAdd={() => setMovingSavings(true)}
        onSave={(v) => {
          // A typed-over balance is a correction: record the delta so the
          // history still explains the number.
          const delta = v - (meta?.savingsBalance ?? 0);
          if (delta === 0) return;
          return addSavingsMove({
            amount: Math.abs(delta),
            direction: delta > 0 ? "in" : "out",
            source: "Correction",
            date: new Date().toISOString(),
          });
        }}
      />

      <SavingsHistory expenses={expenses} />
```

Add the dialog at the end of `<main>`, before its closing tag:

```tsx
      {movingSavings && <SavingsMoveDialog onClose={() => setMovingSavings(false)} />}
```

Note: `expenses` in Dashboard is typed `DashExpense[]`. If `DashExpense` lacks `note`, `category`, or `fundedBySavings`, widen the `SavingsExpense` props type in `SavingsHistory` to match what `DashExpense` actually provides — read `src/components/dashboard/CategoryBars.tsx` where `DashExpense` is defined, and report what you found.

- [ ] **Step 5: "Goes to savings" checkbox**

In `src/components/settings/IncomesEditor.tsx`, inside the `Form`'s field list (after the Cutoff selector), add:

```tsx
      <label className="flex items-center justify-between text-sm">Goes to savings
        <input type="checkbox" checked={!!f.toSavings} onChange={(e) => set("toSavings", e.target.checked)} />
      </label>
      <p className="text-[11px] text-stone-400 -mt-1">Receiving this income moves it into savings instead of spendable cash.</p>
```

In `src/components/AddOneOff.tsx`, add state `const [toSavings, setToSavings] = useState(false);` and, in the `kind === "income"` branch of the form (beside the Day field), the same checkbox bound to that state. Include it in the `addMonthIncome` call:

```ts
      await addMonthIncome(monthKey, { name: name.trim(), amount: amt, day: Number(day) || 1, cutoff, toSavings });
```

- [ ] **Step 6: `ThisMonth` — new call signature, received map, and the label**

In `src/components/ThisMonth.tsx`:

Pass the received map into both `cutoffSummary` call sites so the progress bar accounts for swept income:

```ts
  const totalSurplus = cutoffSummary(lines, incomes, 1, received).surplus + cutoffSummary(lines, incomes, 2, received).surplus;
```

```ts
        const s = cutoffSummary(lines, incomes, cutoff, received);
```

**Important:** `received` is currently declared on line 34, *after* it would now be used on line 75 — check the order and move the `const meta = …` / `const received = …` declarations above `totalSurplus` if needed so there is no use-before-declaration.

Update the `setIncomeReceived` call (line 157) to pass the income object:

```tsx
                            onClick={() => void setIncomeReceived(viewedKey, i, !on)}
```

And label a routed income in the income row, changing:

```tsx
                      <span className="truncate text-emerald-800">↓ {i.name}</span>
```

to:

```tsx
                      <span className="truncate text-emerald-800">
                        ↓ {i.name}
                        {i.toSavings && <span className="ml-1 text-[10px] text-cyan-700">→ savings</span>}
                      </span>
```

- [ ] **Step 7: Report**

Write your report and return. In it, state what `DashExpense` contains and whether `SavingsHistory`'s props needed widening.

---

## Controller verification (after Task 3)

```bash
npm run typecheck && npx vitest run --no-file-parallelism && npm run build
```

## Manual verification (reviewer, after Task 3)

1. Dashboard → **+ Add to savings** → Add ₱5,000 "Side gig". Balance rises; the row appears under Recent.
2. ✕ that row → balance falls back, row disappears.
3. Withdraw ₱1,000 → balance falls, row shows `−₱1,000`.
4. Tap the balance, type a different number, Save → a `Correction` row appears for the difference.
5. A Quick Add expense paid from Savings appears in Recent as an outgoing row with **no** ✕.
6. Settings → Income sources → tick **Goes to savings** on one. On the Month tab it shows `→ savings`; the cutoff's Income includes it, Surplus is unchanged from before the flag.
7. Tick it RECEIVED → savings balance rises, a row appears in Recent, and the cutoff's progress bar advances. Untick → all three reverse.
