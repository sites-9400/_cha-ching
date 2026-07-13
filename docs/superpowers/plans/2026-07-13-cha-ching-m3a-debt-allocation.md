# M3a — Per-Cutoff Debt Allocation Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-cutoff **Debt plan** that allocates each cutoff's free cash across debts by the avalanche method, renders it under each cutoff on This Month with tap-to-pay, and keeps it in sync with the Debts tab (including payment undo).

**Architecture:** A new pure module `src/lib/allocate.ts` computes the allocation from live `Debt[]` + free cash (no Firestore, fully unit-tested). Paid-state is derived — not stored — by subscribing to all `payments` docs via a `collectionGroup` and matching `(debtId, monthKey, cutoff)`. A single shared `ConfirmPayDialog` is the only path that writes a debt payment (from the plan line or the Debts tab), so every payment records a `cutoff` and shares the overpay/zero guards. Undo deletes the payment doc and restores the balance atomically; the plan re-derives, so views never drift.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, Cloud Firestore (`firebase/firestore` v9 modular), Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-13-debt-allocation-guide-design.md` (approved 2026-07-13).
- **Currency render:** always `peso(n)` from `src/lib/format.ts`. Never hand-format ₱.
- **Firestore paths:** only via helpers in `src/lib/paths.ts`. Never inline a path string.
- **Money math is pure + tested:** allocation/cutoff logic lives in `src/lib/*.ts` with Vitest; UI is verified by manual/browser walkthrough (matches M1/M2 convention).
- **No new Firestore index:** paid-state uses a `collectionGroup("payments")` subscription with **no** `where`/`orderBy` (filter client-side), so no composite/collection-group index is required.
- **Avalanche model:** target = active, non-BNPL debt with `currentBalance > 0` and lowest `payoffOrder`. BNPL debts (`isBNPL: true`) are excluded from allocation entirely. Allocation never returns a negative amount and never drives free cash below 0.
- **Cutoff assignment:** `dueDay` 13–24 → cutoff 1; 25–31 or 1–12 → cutoff 2; no `dueDay` → cutoff 2. The target is not restricted by cutoff (it receives leftover free cash in both).
- **Commit style:** small commits per task; message footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do **not** push (auto-deploys on push) until Task 7.

---

## File Structure

- `src/lib/types.ts` — **modify:** add `minimum?: number` to `Debt`.
- `src/lib/repo.ts` — **modify:** `logDebtPayment` gains a `cutoff` param; add `setDebtMinimum`, `undoDebtPayment`.
- `src/lib/allocate.ts` — **create:** `cutoffForDueDay`, `allocateCutoff`, and the `Allocation`/`AllocLine`/`AllocKind` types.
- `src/lib/allocate.test.ts` — **create:** Vitest for the two pure functions.
- `src/hooks/useCollectionGroup.ts` — **create:** live subscription to a collection group, capturing each doc's parent id.
- `src/components/ConfirmPayDialog.tsx` — **create:** shared pay modal (overpay/zero guards) used by both the plan and the Debts tab.
- `src/components/DebtPlan.tsx` — **create:** the per-cutoff plan block (alloc lines + shortfall + paid-state + tap-to-pay).
- `src/components/ThisMonth.tsx` — **modify:** render `<DebtPlan>` under each cutoff; own the debts + payments subscriptions and the dialog state.
- `src/components/Debts.tsx` — **modify:** inline minimum editor, route "Log payment" through `ConfirmPayDialog`, per-payment undo list.

---

### Task 1: `Debt.minimum` field + `setDebtMinimum` + inline minimum editor

**Files:**
- Modify: `src/lib/types.ts` (the `Debt` interface, ~line 31)
- Modify: `src/lib/repo.ts` (add helper)
- Modify: `src/components/Debts.tsx`

**Interfaces:**
- Produces: `Debt.minimum?: number`; `setDebtMinimum(debtId: string, amount: number): Promise<void>`.

- [ ] **Step 1: Add the field.** In `src/lib/types.ts`, add to the `Debt` interface (after `dueDay?: number;`):

```ts
  minimum?: number;
```

- [ ] **Step 2: Add the repo helper.** In `src/lib/repo.ts`, add (uses the already-imported `doc`, `updateDoc`, `db`, `debtsCol`):

```ts
/** Set a debt's monthly minimum payment. */
export async function setDebtMinimum(debtId: string, amount: number): Promise<void> {
  await updateDoc(doc(db, debtsCol(), debtId), { minimum: amount });
}
```

- [ ] **Step 3: Inline minimum editor on the Debts card.** In `src/components/Debts.tsx`, import the helper and add per-card minimum state + control. Add to the imports:

```ts
import { logDebtPayment, setDebtMinimum } from "../lib/repo";
```

Add state near the other `useState` calls:

```ts
  const [minEditId, setMinEditId] = useState<string | null>(null);
  const [minValue, setMinValue] = useState("");

  async function saveMin(id: string) {
    const v = Number(minValue);
    if (v >= 0) await setDebtMinimum(id, v);
    setMinEditId(null);
    setMinValue("");
  }
```

Inside the card `<li>`, below the progress bar (`div.h-2 ...`) and above the channel/pay row, add a minimum row:

```tsx
              <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                {minEditId === d.id ? (
                  <span className="flex items-center gap-1">
                    <span>Min ₱</span>
                    <input
                      type="number" inputMode="decimal" autoFocus
                      value={minValue} onChange={(e) => setMinValue(e.target.value)}
                      className="w-20 border-b border-stone-300 outline-none tabular-nums"
                    />
                    <button onClick={() => void saveMin(d.id)} className="font-semibold text-emerald-700 px-1">Save</button>
                    <button onClick={() => { setMinEditId(null); setMinValue(""); }} className="text-stone-400">✕</button>
                  </span>
                ) : d.minimum != null ? (
                  <button onClick={() => { setMinEditId(d.id); setMinValue(String(d.minimum)); }}>
                    Min {peso(d.minimum)} · edit
                  </button>
                ) : (
                  <button
                    onClick={() => { setMinEditId(d.id); setMinValue(""); }}
                    className="text-amber-600 font-medium"
                  >
                    Set minimum
                  </button>
                )}
              </div>
```

- [ ] **Step 4: Typecheck + build.** Run: `npm run build`
Expected: PASS (tsc + vite build, no type errors).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/types.ts src/lib/repo.ts src/components/Debts.tsx
git commit -m "feat(m3a): Debt.minimum field + setDebtMinimum + inline minimum editor"
```

---

### Task 2: `cutoffForDueDay` + `allocateCutoff` pure functions (TDD)

**Files:**
- Create: `src/lib/allocate.ts`
- Test: `src/lib/allocate.test.ts`

**Interfaces:**
- Consumes: `Debt` (with `minimum?`, `dueDay?`, `payoffOrder`, `isBNPL`, `currentBalance`, `active`, `channel`, `name`) and `Channel` from `./types`.
- Produces:
  - `cutoffForDueDay(dueDay: number | undefined): 1 | 2`
  - `allocateCutoff(freeCash: number, debts: Debt[], cutoff: 1 | 2): Allocation`
  - `type AllocKind = "minimum" | "target" | "spill"`
  - `interface AllocLine { debtId: string; name: string; amount: number; kind: AllocKind; channel: Channel; minIncluded?: number }`
  - `interface Allocation { lines: AllocLine[]; shortfall: number }`

- [ ] **Step 1: Write the failing tests.** Create `src/lib/allocate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { allocateCutoff, cutoffForDueDay } from "./allocate";
import type { Debt } from "./types";

const D = (over: Partial<Debt>): Debt => ({
  id: over.name ?? "x", name: "x", startingBalance: 0, currentBalance: 0,
  payoffOrder: 0, channel: "RCBC", isBNPL: false, active: true, ...over,
});

// Real July data, payoff order: REVI(1) < Classic(2) < Gold(3), plus a BNPL laptop.
const debtsJuly = (over: Record<string, Partial<Debt>> = {}): Debt[] => [
  D({ id: "revi", name: "REVI", payoffOrder: 1, currentBalance: 17265, dueDay: 16, channel: "CIMB", ...over.revi }),
  D({ id: "classic", name: "RCBC Classic", payoffOrder: 2, currentBalance: 6337, dueDay: 4, ...over.classic }),
  D({ id: "gold", name: "RCBC Gold", payoffOrder: 3, currentBalance: 44871, dueDay: 28, ...over.gold }),
  D({ id: "laptop", name: "Laptop", payoffOrder: 9, currentBalance: 51995, isBNPL: true, ...over.laptop }),
];

describe("cutoffForDueDay", () => {
  it("maps due days to cutoffs incl. boundaries", () => {
    expect(cutoffForDueDay(16)).toBe(1);
    expect(cutoffForDueDay(28)).toBe(2);
    expect(cutoffForDueDay(4)).toBe(2);
    expect(cutoffForDueDay(10)).toBe(2);
    expect(cutoffForDueDay(24)).toBe(1);
    expect(cutoffForDueDay(25)).toBe(2);
    expect(cutoffForDueDay(12)).toBe(2);
    expect(cutoffForDueDay(13)).toBe(1);
    expect(cutoffForDueDay(undefined)).toBe(2);
  });
});

describe("allocateCutoff", () => {
  it("1st cutoff July: single target line REVI 15,933", () => {
    const a = allocateCutoff(15933, debtsJuly(), 1);
    expect(a.shortfall).toBe(0);
    expect(a.lines).toHaveLength(1);
    expect(a.lines[0]).toMatchObject({ debtId: "revi", amount: 15933, kind: "target" });
    expect(a.lines[0].minIncluded).toBeUndefined();
  });

  it("2nd cutoff July: one merged line per debt in payoff order", () => {
    // REVI down to 1,332 after 1st cutoff; only Gold's minimum (1,090) is set.
    const debts = debtsJuly({
      revi: { currentBalance: 1332 },
      gold: { currentBalance: 26339, minimum: 1090 },
    });
    const a = allocateCutoff(34008, debts, 2);
    expect(a.shortfall).toBe(0);
    expect(a.lines.map((l) => l.debtId)).toEqual(["revi", "classic", "gold"]);
    expect(a.lines[0]).toMatchObject({ amount: 1332, kind: "target" });
    expect(a.lines[1]).toMatchObject({ debtId: "classic", amount: 6337, kind: "spill" });
    expect(a.lines[2]).toMatchObject({ debtId: "gold", amount: 26339, kind: "spill", minIncluded: 1090 });
    expect(a.lines.reduce((s, l) => s + l.amount, 0)).toBe(34008);
  });

  it("tight month: free cash only covers minimums → no target line", () => {
    // free cash == the one required minimum; nothing spills to the target.
    const debts = debtsJuly({ gold: { minimum: 1090 } });
    const a = allocateCutoff(1090, debts, 2);
    expect(a.shortfall).toBe(0);
    expect(a.lines).toEqual([
      expect.objectContaining({ debtId: "gold", amount: 1090, kind: "minimum" }),
    ]);
    expect(a.lines.some((l) => l.kind === "target")).toBe(false);
  });

  it("short month: free cash < minimums → shortfall, no negative amounts", () => {
    const debts = debtsJuly({ gold: { minimum: 1090 } });
    const a = allocateCutoff(400, debts, 2);
    expect(a.shortfall).toBe(690); // 1090 - 400
    expect(a.lines.every((l) => l.amount >= 0)).toBe(true);
    expect(a.lines.reduce((s, l) => s + l.amount, 0)).toBeLessThanOrEqual(400);
  });

  it("excludes BNPL debts from allocation entirely", () => {
    const a = allocateCutoff(999999, debtsJuly(), 2);
    expect(a.lines.some((l) => l.debtId === "laptop")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail.** Run: `npx vitest run src/lib/allocate.test.ts`
Expected: FAIL — cannot find module `./allocate`.

- [ ] **Step 3: Implement `allocate.ts`.** Create `src/lib/allocate.ts`:

```ts
import type { Channel, Debt } from "./types";

export type AllocKind = "minimum" | "target" | "spill";

export interface AllocLine {
  debtId: string;
  name: string;
  amount: number;
  kind: AllocKind;
  channel: Channel;
  minIncluded?: number;
}

export interface Allocation {
  lines: AllocLine[];
  shortfall: number;
}

/** Due-day → cutoff: 13–24 → 1; 25–31 or 1–12 → 2; unset → 2 (later, safer). */
export function cutoffForDueDay(dueDay: number | undefined): 1 | 2 {
  if (dueDay === undefined) return 2;
  return dueDay >= 13 && dueDay <= 24 ? 1 : 2;
}

/**
 * Allocate a cutoff's free cash across debts by avalanche:
 * reserve non-target minimums assigned to this cutoff, then waterfall the rest
 * down the payoff order. Exactly one merged line per debt. Pure — no Firestore.
 */
export function allocateCutoff(freeCash: number, debts: Debt[], cutoff: 1 | 2): Allocation {
  const cands = debts
    .filter((d) => d.active && !d.isBNPL && d.currentBalance > 0)
    .sort((a, b) => a.payoffOrder - b.payoffOrder);
  const target = cands[0]; // lowest payoffOrder, or undefined if none

  const acc = new Map<string, { min: number; water: number }>();
  const bucket = (id: string) => {
    let b = acc.get(id);
    if (!b) { b = { min: 0, water: 0 }; acc.set(id, b); }
    return b;
  };

  let remaining = freeCash;
  let requiredMin = 0;

  // Minimums pass: non-target debts assigned to this cutoff, with a positive minimum.
  for (const d of cands) {
    if (target && d.id === target.id) continue;
    if (cutoffForDueDay(d.dueDay) !== cutoff) continue;
    const min = d.minimum ?? 0;
    if (min <= 0) continue;
    requiredMin += Math.min(min, d.currentBalance);
    const reserve = Math.min(min, d.currentBalance, Math.max(0, remaining));
    if (reserve <= 0) continue;
    bucket(d.id).min += reserve;
    remaining -= reserve;
  }

  const shortfall = Math.max(0, requiredMin - freeCash);

  // Waterfall pass: send everything left down the payoff order, capped by balance.
  for (const d of cands) {
    if (remaining <= 0) break;
    const b = bucket(d.id);
    const capacity = d.currentBalance - b.min;
    if (capacity <= 0) continue;
    const pay = Math.min(capacity, remaining);
    b.water += pay;
    remaining -= pay;
  }

  // Merge → one line per debt that received money, in payoff order.
  const lines: AllocLine[] = [];
  for (const d of cands) {
    const b = acc.get(d.id);
    if (!b) continue;
    const amount = b.min + b.water;
    if (amount <= 0) continue;
    const isTarget = !!target && d.id === target.id;
    const kind: AllocKind = isTarget ? "target" : b.water > 0 ? "spill" : "minimum";
    const line: AllocLine = { debtId: d.id, name: d.name, amount, kind, channel: d.channel };
    if (b.min > 0 && b.water > 0) line.minIncluded = b.min;
    lines.push(line);
  }

  return { lines, shortfall };
}
```

- [ ] **Step 4: Run tests to verify they pass.** Run: `npx vitest run src/lib/allocate.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/allocate.ts src/lib/allocate.test.ts
git commit -m "feat(m3a): allocateCutoff + cutoffForDueDay pure functions with tests"
```

---

### Task 3: Payment `cutoff` field, `undoDebtPayment`, and the payments subscription

**Files:**
- Modify: `src/lib/repo.ts` (`logDebtPayment` signature; add `undoDebtPayment`)
- Create: `src/hooks/useCollectionGroup.ts`

**Interfaces:**
- Consumes: `debtPayments(debtId)` from `paths.ts`; `db` from `firebase.ts`.
- Produces:
  - `logDebtPayment(debtId: string, amount: number, monthKey: string, cutoff: 1 | 2): Promise<void>`
  - `undoDebtPayment(debtId: string, paymentId: string, amount: number): Promise<void>`
  - `useCollectionGroup<T>(groupId: string): T[]` — each item is `{ id, debtId, ...data }`.
  - Payment doc shape is now `{ amount, date, monthKey, cutoff }`.

- [ ] **Step 1: Add `cutoff` to `logDebtPayment`.** In `src/lib/repo.ts`, replace the `logDebtPayment` function with:

```ts
/** Record a debt payment: append to history (with cutoff) + decrement balance atomically. */
export async function logDebtPayment(
  debtId: string, amount: number, monthKey: string, cutoff: 1 | 2,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, debtPayments(debtId))), {
    amount, date: new Date().toISOString(), monthKey, cutoff,
  });
  batch.update(doc(db, debtsCol(), debtId), { currentBalance: increment(-amount) });
  await batch.commit();
}

/** Undo a payment: delete the payment doc + restore the balance atomically. */
export async function undoDebtPayment(
  debtId: string, paymentId: string, amount: number,
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, debtPayments(debtId), paymentId));
  batch.update(doc(db, debtsCol(), debtId), { currentBalance: increment(amount) });
  await batch.commit();
}
```

Ensure `deleteDoc` is not needed here (we use `batch.delete`); the existing imports already include `writeBatch`, `doc`, `collection`, `increment`, `updateDoc`. No import change required.

- [ ] **Step 2: Create the collection-group hook.** Create `src/hooks/useCollectionGroup.ts`:

```ts
import { collectionGroup, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";

/**
 * Live-subscribe to a collection group (e.g. every debt's "payments").
 * Each item carries its own id plus `debtId` = the parent debt doc id.
 * No where/orderBy → no custom index required; filter client-side.
 */
export function useCollectionGroup<T>(groupId: string): T[] {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    const un = onSnapshot(query(collectionGroup(db, groupId)), (snap) =>
      setItems(
        snap.docs.map((d) => ({ id: d.id, debtId: d.ref.parent.parent?.id, ...d.data() }) as T),
      ),
    );
    return un;
  }, [groupId]);
  return items;
}
```

- [ ] **Step 3: Fix the existing `logDebtPayment` caller so the build passes.** In `src/components/Debts.tsx`, the current `pay()` calls `logDebtPayment(id, v, currentMonthKey())` (3 args). Task 4 rewrites this flow entirely; for now, keep the build green by removing the now-broken inline `pay()` path — it is replaced in Task 4. Temporarily change the call to pass a cutoff:

```ts
    if (v > 0) await logDebtPayment(id, v, currentMonthKey(), 2);
```

(This is a throwaway line replaced in Task 4; it only keeps `npm run build` green between commits.)

- [ ] **Step 4: Typecheck + build.** Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/repo.ts src/hooks/useCollectionGroup.ts src/components/Debts.tsx
git commit -m "feat(m3a): payment cutoff field, undoDebtPayment, collectionGroup hook"
```

---

### Task 4: Shared `ConfirmPayDialog` + rewire the Debts tab to use it

**Files:**
- Create: `src/components/ConfirmPayDialog.tsx`
- Modify: `src/components/Debts.tsx`

**Interfaces:**
- Consumes: `logDebtPayment` (4-arg), `peso`, `cutoffForDueDay`.
- Produces: `ConfirmPayDialog` React component with props:

```ts
interface ConfirmPayDialogProps {
  debtName: string;
  currentBalance: number;
  defaultAmount: number;   // pre-fill (alloc line amount, or currentBalance from Debts tab)
  onConfirm: (amount: number) => void | Promise<void>;
  onCancel: () => void;
}
```

- [ ] **Step 1: Create the dialog.** Create `src/components/ConfirmPayDialog.tsx`:

```tsx
import { useState } from "react";
import { peso } from "../lib/format";

interface ConfirmPayDialogProps {
  debtName: string;
  currentBalance: number;
  defaultAmount: number;
  onConfirm: (amount: number) => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmPayDialog({
  debtName, currentBalance, defaultAmount, onConfirm, onCancel,
}: ConfirmPayDialogProps) {
  const [raw, setRaw] = useState(String(Math.round(defaultAmount)));
  const [busy, setBusy] = useState(false);
  const amount = Number(raw);
  const valid = amount > 0;
  const over = amount > currentBalance;

  async function confirm() {
    if (!valid || busy) return;
    setBusy(true);
    try { await onConfirm(amount); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-base mb-1">Pay {debtName}</h3>
        <p className="text-xs text-stone-500 mb-3">Balance {peso(currentBalance)}</p>
        <input
          type="number" inputMode="decimal" autoFocus
          value={raw} onChange={(e) => setRaw(e.target.value)}
          className="w-full text-lg font-semibold tabular-nums border-b-2 border-stone-300 outline-none focus:border-emerald-500 pb-1 mb-2"
        />
        {over && (
          <p className="text-[11px] text-amber-600 mb-2">
            More than the balance — pay {peso(currentBalance)} to clear it?
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button
            onClick={() => void confirm()} disabled={!valid || busy}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewire the Debts tab.** In `src/components/Debts.tsx`: remove the inline `payingId`/`amount` number-input flow and the throwaway `pay()`; open `ConfirmPayDialog` instead. Update imports:

```ts
import ConfirmPayDialog from "./ConfirmPayDialog";
import { cutoffForDueDay } from "../lib/allocate";
```

Replace the `payingId`/`amount` state and `pay()` with:

```ts
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
```

Replace the entire pay UI block (the `payingId === d.id ? (...) : (...)` ternary) with a single button:

```tsx
                <button onClick={() => setPayDebt(d)} className="text-xs font-semibold text-emerald-700">
                  Log payment
                </button>
```

Then, just before the closing `</main>`, render the dialog:

```tsx
      {payDebt && (
        <ConfirmPayDialog
          debtName={payDebt.name}
          currentBalance={payDebt.currentBalance}
          defaultAmount={payDebt.currentBalance}
          onConfirm={async (amt) => {
            await logDebtPayment(payDebt.id, amt, currentMonthKey(), cutoffForDueDay(payDebt.dueDay));
            setPayDebt(null);
          }}
          onCancel={() => setPayDebt(null)}
        />
      )}
```

Confirm `logDebtPayment` and `currentMonthKey` are still imported (they are, from Task 3 / existing). Remove the now-unused `useState` for `amount` if the linter flags it.

- [ ] **Step 3: Typecheck + build.** Run: `npm run build`
Expected: PASS (no unused-var errors; `payingId`/`amount` fully removed).

- [ ] **Step 4: Commit.**

```bash
git add src/components/ConfirmPayDialog.tsx src/components/Debts.tsx
git commit -m "feat(m3a): shared ConfirmPayDialog; route Debts-tab pay through it"
```

---

### Task 5: `DebtPlan` block on This Month (allocation + shortfall + paid-state + tap-to-pay)

**Files:**
- Create: `src/components/DebtPlan.tsx`
- Modify: `src/components/ThisMonth.tsx`

**Interfaces:**
- Consumes: `allocateCutoff`, `AllocLine` (`allocate.ts`); `useCollection`, `useCollectionGroup`; `logDebtPayment`; `peso`, `channelChipSafe`; `Debt` type; `useMonth`.
- Payment record type for paid-state: `interface PaymentRec { id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2 }`.

- [ ] **Step 1: Create `DebtPlan.tsx`.** This component receives the cutoff's free cash, the debts, and this month's payments, and renders the allocation:

```tsx
import { useState } from "react";
import { channelChipSafe } from "../lib/channels";
import { peso } from "../lib/format";
import { logDebtPayment } from "../lib/repo";
import { allocateCutoff } from "../lib/allocate";
import type { Debt } from "../lib/types";
import ConfirmPayDialog from "./ConfirmPayDialog";

export interface PaymentRec {
  id: string; debtId: string; amount: number; monthKey: string; cutoff: 1 | 2;
}

const KIND_LABEL: Record<string, string> = { target: "target", spill: "spill", minimum: "min" };

export default function DebtPlan({
  freeCash, debts, payments, monthKey, cutoff,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; monthKey: string; cutoff: 1 | 2;
}) {
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const alloc = allocateCutoff(freeCash, debts, cutoff);

  const isPaid = (debtId: string) =>
    payments.some((p) => p.debtId === debtId && p.monthKey === monthKey && p.cutoff === cutoff);

  if (alloc.lines.length === 0 && alloc.shortfall === 0) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <p className="text-xs font-semibold text-stone-500 mb-2">DEBT PLAN · free cash {peso(freeCash)}</p>
      <ul className="flex flex-col gap-1.5">
        {alloc.lines.map((l) => {
          const paid = isPaid(l.debtId);
          return (
            <li key={l.debtId} className="flex items-center justify-between gap-2 text-sm">
              <button
                disabled={paid}
                onClick={() => setPayDebt(debts.find((d) => d.id === l.debtId) ?? null)}
                className="flex items-center gap-2 min-w-0"
              >
                <span className={paid ? "text-emerald-600" : "text-stone-300"}>✓</span>
                <span className={`truncate ${paid ? "line-through text-stone-400" : "font-medium"}`}>{l.name}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${channelChipSafe(l.channel)}`}>
                  {l.channel}
                </span>
                <span className="text-[10px] text-stone-400">{KIND_LABEL[l.kind]}</span>
              </button>
              <span className="text-right shrink-0">
                <span className="font-bold tabular-nums">{peso(l.amount)}</span>
                {l.minIncluded != null && (
                  <span className="block text-[10px] text-stone-400">incl. {peso(l.minIncluded)} min</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {alloc.shortfall > 0 && (
        <p className="mt-2 text-xs font-semibold text-red-600">
          Short {peso(alloc.shortfall)} for minimums this cutoff.
        </p>
      )}
      {payDebt && (
        <ConfirmPayDialog
          debtName={payDebt.name}
          currentBalance={payDebt.currentBalance}
          defaultAmount={alloc.lines.find((l) => l.debtId === payDebt.id)?.amount ?? payDebt.currentBalance}
          onConfirm={async (amt) => {
            await logDebtPayment(payDebt.id, amt, monthKey, cutoff);
            setPayDebt(null);
          }}
          onCancel={() => setPayDebt(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `ThisMonth.tsx`.** Add subscriptions at the top of the component and render `<DebtPlan>` inside each cutoff section. Update imports:

```ts
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { debtsCol } from "../lib/paths";
import type { Debt } from "../lib/types";
import DebtPlan, { type PaymentRec } from "./DebtPlan";
```

Inside `ThisMonth`, after `const { monthKey, lines, incomes, ready } = useMonth();`, add:

```ts
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
```

Then inside the cutoff `.map`, after the `</ul>` of line rows and before the Income/Surplus `<p>`, insert:

```tsx
            <DebtPlan
              freeCash={s.surplus}
              debts={debts}
              payments={payments}
              monthKey={monthKey}
              cutoff={cutoff}
            />
```

- [ ] **Step 3: Typecheck + build.** Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/components/DebtPlan.tsx src/components/ThisMonth.tsx
git commit -m "feat(m3a): DebtPlan block on This Month with tap-to-pay + paid-state"
```

---

### Task 6: Undo control on the Debts tab

**Files:**
- Modify: `src/components/Debts.tsx`

**Interfaces:**
- Consumes: `useCollectionGroup`, `undoDebtPayment`, `currentMonthKey`, `peso`, `PaymentRec` (from `DebtPlan`).

- [ ] **Step 1: Subscribe to payments + list this month's per debt.** In `src/components/Debts.tsx`, add imports:

```ts
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { undoDebtPayment } from "../lib/repo";
import type { PaymentRec } from "./DebtPlan";
```

Add near the top of the component:

```ts
  const payments = useCollectionGroup<PaymentRec>("payments");
  const thisMonth = currentMonthKey();
```

Inside the card `<li>`, below the minimum row, render this month's payments with an undo action:

```tsx
              {payments
                .filter((p) => p.debtId === d.id && p.monthKey === thisMonth)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Paid {peso(p.amount)} · cutoff {p.cutoff}</span>
                    <button
                      onClick={() => void undoDebtPayment(d.id, p.id, p.amount)}
                      className="text-red-500 font-medium"
                    >
                      Undo
                    </button>
                  </div>
                ))}
```

- [ ] **Step 2: Typecheck + build.** Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Run the full test suite.** Run: `npx vitest run`
Expected: PASS (allocate + existing selectors/channels/clock/paths tests).

- [ ] **Step 4: Commit.**

```bash
git add src/components/Debts.tsx
git commit -m "feat(m3a): per-payment undo on the Debts tab"
```

---

### Task 7: Live verification + deploy

**Files:** none (verification + release).

- [ ] **Step 1: Full build + tests green.** Run: `npm run build && npx vitest run`
Expected: both PASS.

- [ ] **Step 2: Browser walkthrough (controller-driven on `npm run dev` or the live site).** Verify, in order:
  1. Debts tab → a debt with no minimum shows **Set minimum**; set it → shows **Min ₱X · edit**.
  2. This Month → each cutoff shows a **DEBT PLAN** block; 1st cutoff July shows a single **REVI** target line equal to that cutoff's free cash.
  3. Tap a plan line → `ConfirmPayDialog` opens pre-filled → Confirm → the debt's balance drops (Debts tab), the plan line shows **✓** and strikes through, and the allocation re-derives (surplus of that cutoff's remaining flows to the next debt).
  4. Debts tab → the payment appears with **Undo** → tap Undo → balance restored, plan line reverts to unpaid.
  5. Debts tab → **Log payment** opens the same dialog; a zero amount leaves Confirm disabled (no silent close); an over-balance amount shows the amber warning but still allows confirm.
  6. Reload → all state persists (it's all derived from Firestore).

- [ ] **Step 3: Confirm with the user before deploying.** Deploy = push to `main` → GitHub Actions auto-build + deploy to Firebase Hosting (outward-facing). Ask the user to approve the push. On approval:

```bash
git push origin main
```

- [ ] **Step 4: Verify the deploy.** Watch the GitHub Actions run to green, then load `https://cha-ching-c3470.web.app` and re-check the plan renders on This Month.

---

## Self-Review

**Spec coverage** (each spec section → task):
- Allocation model (minimums + waterfall + merge, kinds, minIncluded) → Task 2 ✓
- Due-day → cutoff assignment → Task 2 (`cutoffForDueDay`) ✓
- Shortfall flag → Task 2 (`Allocation.shortfall`) + Task 5 (render) ✓
- `Debt.minimum` field + `setDebtMinimum` + inline editor → Task 1 ✓
- `allocateCutoff`/`cutoffForDueDay` pure + tested → Task 2 ✓
- Payment `cutoff` field + paid-state derivation → Task 3 (field/hook) + Task 5 (`isPaid`) ✓
- `DebtPlan` block (lines, channel chip, kind, ✓ paid, shortfall) → Task 5 ✓
- `ConfirmPayDialog` (overpay/zero guards) shared by plan + Debts tab → Task 4 (+ used in Task 5) ✓
- Inline minimum editor → Task 1 ✓
- Undo (M3a scope, restores balance, reverts plan line) → Task 3 (`undoDebtPayment`) + Task 6 (UI) ✓
- Testing: 1st/2nd cutoff, tight, short, boundary cutoffForDueDay → Task 2 tests ✓; manual walkthrough → Task 7 ✓

**Type consistency:** `logDebtPayment(debtId, amount, monthKey, cutoff)` used identically in Tasks 3/4/5. `PaymentRec` defined once (in `DebtPlan.tsx`), imported by `ThisMonth` and `Debts`. `AllocLine.minIncluded`, `.kind` ("minimum"|"target"|"spill") consistent between `allocate.ts` and `DebtPlan.tsx`. `useCollectionGroup<T>` returns `{id, debtId, ...}` matching `PaymentRec`.

**Placeholder scan:** none — every code step shows full code; every run step gives the exact command + expected result.
