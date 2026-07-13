# M6 — Month Navigation, Projections & One-Off Lines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the month navigable (past read-only / current editable / future projected + startable), project future months with a forward-simulated debt plan, allow one-off expense and income lines on editable months, and reconcile the current month when template lines change — preserving ticks and one-offs.

**Architecture:** New pure modules `project.ts` (forward simulation) and `reconcile.ts` (template↔month diff), both TDD'd. `MonthProvider` is reworked to hold a *viewed* month and derive a mode; only the current month auto-generates. `ThisMonth` renders read-only / editable / projected by mode. Repo gains month-scoped line/income CRUD, `syncMonthFromTemplate`, and `startMonth`.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind, Cloud Firestore (v9 modular), Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-13-month-navigation-design.md`.
- **Paths only via `paths.ts`; currency via `peso()`; channels from `CHANNELS`.**
- **Pure logic is unit-tested** (`project.ts`, `reconcile.ts`); UI verified manually.
- **Only the current month auto-generates.** Future months are created solely by an explicit **Start**. Projections are computed live and **never written**.
- **Reconcile preserves state:** `syncMonthFromTemplate` updates template-derived lines' `{name,amount,channel,cutoff,order}` but keeps `{status,paidDate}`, adds new template lines blank, deletes removed ones, and **never touches `oneOff:true` lines**.
- **Editable** = current month OR a started future month. **Past** and **projected** (unstarted future) months are strictly read-only.
- **Commit per task; footer** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Push only in Task 8.
- **Verify each task:** `npm run typecheck && npm run build`; `npx vitest run` for tasked-with-tests.

## File Structure

- `src/lib/project.ts` + `.test.ts` — **create:** `applyAllocation`, `simulateBalances`, `projectMonthPlan`.
- `src/lib/reconcile.ts` + `.test.ts` — **create:** `reconcileLines`.
- `src/lib/paths.ts` — **modify:** add `monthIncomes`.
- `src/lib/repo.ts` — **modify:** `addMonthLine`, `deleteMonthLine`, `addMonthIncome`, `deleteMonthIncome`, `syncMonthFromTemplate`, `startMonth`.
- `src/components/MonthProvider.tsx` — **rework:** viewed month + modes.
- `src/components/LineRow.tsx` — **modify:** `readOnly` prop.
- `src/components/DebtPlan.tsx` — **modify:** `readOnly` prop.
- `src/components/ThisMonth.tsx` — **rework:** nav header, modes, merged incomes, one-off + sync controls, projected view.
- `src/components/AddOneOff.tsx` — **create:** expense/income dialog.
- `src/components/settings/TemplateEditor.tsx` — **modify:** reconcile after save; delete-warns.

---

### Task 1: Pure simulation + reconcile (`project.ts`, `reconcile.ts`) — TDD

**Files:** Create `src/lib/project.ts`, `src/lib/project.test.ts`, `src/lib/reconcile.ts`, `src/lib/reconcile.test.ts`.

**Interfaces:**
- Produces:
  - `applyAllocation(debts: Debt[], alloc: Allocation): Debt[]`
  - `simulateBalances(debts: Debt[], steps: {c1:number;c2:number}[]): Debt[]`
  - `projectMonthPlan(viewedKey, currentKey, debts, template, events, incomes): { free: {c1:number;c2:number}; alloc: {c1: Allocation; c2: Allocation} }`
  - `reconcileLines(template: TemplateLine[], monthLines: MonthLine[]): { upserts: MonthLine[]; deletes: string[] }`

- [ ] **Step 1: Write `project.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { applyAllocation, projectMonthPlan, simulateBalances } from "./project";
import type { Debt, EventItem, Income, TemplateLine } from "./types";

const D = (o: Partial<Debt>): Debt => ({
  id: o.name ?? "x", name: "x", startingBalance: 0, currentBalance: 0,
  payoffOrder: 0, channel: "RCBC", isBNPL: false, active: true, ...o,
});

describe("applyAllocation", () => {
  it("subtracts each line's amount from its debt, flooring at 0", () => {
    const debts = [D({ id: "a", currentBalance: 1000 }), D({ id: "b", currentBalance: 500 })];
    const out = applyAllocation(debts, {
      lines: [
        { debtId: "a", name: "a", amount: 600, kind: "target", channel: "RCBC" },
        { debtId: "b", name: "b", amount: 900, kind: "spill", channel: "RCBC" },
      ],
      shortfall: 0,
    });
    expect(out.find((d) => d.id === "a")!.currentBalance).toBe(400);
    expect(out.find((d) => d.id === "b")!.currentBalance).toBe(0); // floored
  });
});

describe("simulateBalances", () => {
  it("folds each month's two cutoffs down the avalanche", () => {
    const debts = [D({ id: "revi", currentBalance: 1000, payoffOrder: 1 })];
    const out = simulateBalances(debts, [{ c1: 300, c2: 200 }]);
    expect(out[0].currentBalance).toBe(500); // 1000 − 300 − 200
  });
  it("is a no-op with no steps", () => {
    const debts = [D({ id: "revi", currentBalance: 1000 })];
    expect(simulateBalances(debts, [])[0].currentBalance).toBe(1000);
  });
});

describe("projectMonthPlan", () => {
  const template: TemplateLine[] = [
    { id: "inc-planned", name: "x", amount: 0, channel: "CIMB", cutoff: 1, order: 1 },
  ];
  const incomes: Income[] = [{ id: "i1", name: "Pay", amount: 20000, day: 13, cutoff: 1 }];
  const events: EventItem[] = [];
  const debts = [D({ id: "revi", name: "REVI", currentBalance: 50000, payoffOrder: 1 })];

  it("targets the projected free cash at the payoff-order debt, on simulated balances", () => {
    // one month between current (2026-07) and target (2026-09): 2026-08.
    // each month cutoff1 free cash = 20000 income − 0 planned = 20000; cutoff2 = 0.
    const r = projectMonthPlan("2026-09", "2026-07", debts, template, events, incomes);
    expect(r.free.c1).toBe(20000);
    // Aug applied 20000 → REVI 30000 at start of Sep; Sep c1 20000 → REVI line 20000.
    expect(r.alloc.c1.lines[0]).toMatchObject({ debtId: "revi", amount: 20000, kind: "target" });
  });
});
```

- [ ] **Step 2: Run — fail.** `npx vitest run src/lib/project.test.ts` → FAIL (no module).

- [ ] **Step 3: Implement `project.ts`.**

```ts
import { addMonths } from "./format";
import { allocateCutoff, type Allocation } from "./allocate";
import { cutoffSummary, generateMonthLines } from "./selectors";
import type { Debt, EventItem, Income, TemplateLine } from "./types";

/** Subtract each allocation line's amount from its debt's balance (floored at 0). Pure. */
export function applyAllocation(debts: Debt[], alloc: Allocation): Debt[] {
  const paid = new Map<string, number>();
  for (const l of alloc.lines) paid.set(l.debtId, (paid.get(l.debtId) ?? 0) + l.amount);
  return debts.map((d) =>
    paid.has(d.id) ? { ...d, currentBalance: Math.max(0, d.currentBalance - paid.get(d.id)!) } : d,
  );
}

/** Fold whole months forward: each step runs cutoff 1 then cutoff 2 down the avalanche. Pure. */
export function simulateBalances(debts: Debt[], steps: { c1: number; c2: number }[]): Debt[] {
  let bal = debts;
  for (const step of steps) {
    bal = applyAllocation(bal, allocateCutoff(step.c1, bal, 1));
    bal = applyAllocation(bal, allocateCutoff(step.c2, bal, 2));
  }
  return bal;
}

/**
 * Project a future month's debt plan: simulate every whole month strictly between
 * `currentKey` and `viewedKey`, then compute the viewed month's two cutoff
 * allocations on the simulated balances. Pure.
 */
export function projectMonthPlan(
  viewedKey: string,
  currentKey: string,
  debts: Debt[],
  template: TemplateLine[],
  events: EventItem[],
  incomes: Income[],
): { free: { c1: number; c2: number }; alloc: { c1: Allocation; c2: Allocation } } {
  const freeFor = (mk: string) => {
    const ln = generateMonthLines(template, events, mk);
    return {
      c1: Math.max(0, cutoffSummary(ln, incomes, 1).surplus),
      c2: Math.max(0, cutoffSummary(ln, incomes, 2).surplus),
    };
  };
  const between: string[] = [];
  for (let m = addMonths(currentKey, 1); m < viewedKey; m = addMonths(m, 1)) between.push(m);
  const simDebts = simulateBalances(debts, between.map(freeFor));

  const free = freeFor(viewedKey);
  const c1 = allocateCutoff(free.c1, simDebts, 1);
  const afterC1 = applyAllocation(simDebts, c1);
  const c2 = allocateCutoff(free.c2, afterC1, 2);
  return { free, alloc: { c1, c2 } };
}
```

- [ ] **Step 4: Run — pass.** `npx vitest run src/lib/project.test.ts` → PASS.

- [ ] **Step 5: Write `reconcile.test.ts`.**

```ts
import { describe, expect, it } from "vitest";
import { reconcileLines } from "./reconcile";
import type { MonthLine, TemplateLine } from "./types";

const T = (o: Partial<TemplateLine>): TemplateLine =>
  ({ id: "t", name: "t", amount: 0, channel: "CIMB", cutoff: 1, order: 0, ...o });
const M = (o: Partial<MonthLine>): MonthLine =>
  ({ id: "t", name: "t", amount: 0, channel: "CIMB", cutoff: 1, order: 0, status: "", oneOff: false, ...o });

describe("reconcileLines", () => {
  it("updates an existing line's fields but keeps its status/paidDate", () => {
    const template = [T({ id: "a", name: "Rent", amount: 12000, order: 3 })];
    const month = [M({ id: "a", name: "Rent", amount: 10000, status: "PAID", paidDate: "2026-07-05" })];
    const { upserts, deletes } = reconcileLines(template, month);
    expect(deletes).toEqual([]);
    expect(upserts[0]).toMatchObject({ id: "a", amount: 12000, order: 3, status: "PAID", paidDate: "2026-07-05" });
  });
  it("adds a new template line as a blank month line", () => {
    const { upserts } = reconcileLines([T({ id: "new", name: "Gym", amount: 500 })], []);
    expect(upserts[0]).toMatchObject({ id: "new", name: "Gym", amount: 500, status: "", oneOff: false });
  });
  it("deletes a template-derived line whose template is gone", () => {
    const { deletes } = reconcileLines([], [M({ id: "gone" })]);
    expect(deletes).toEqual(["gone"]);
  });
  it("never touches one-off lines", () => {
    const month = [M({ id: "event-1", oneOff: true })];
    const { upserts, deletes } = reconcileLines([], month);
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });
});
```

- [ ] **Step 6: Run — fail.** `npx vitest run src/lib/reconcile.test.ts` → FAIL.

- [ ] **Step 7: Implement `reconcile.ts`.**

```ts
import type { MonthLine, TemplateLine } from "./types";

/**
 * Diff the template against a month's lines. Template-derived lines (oneOff:false)
 * are upserted from the template but KEEP status/paidDate; missing templates are
 * added blank; removed templates are deleted. oneOff lines are never touched. Pure.
 */
export function reconcileLines(
  template: TemplateLine[],
  monthLines: MonthLine[],
): { upserts: MonthLine[]; deletes: string[] } {
  const byId = new Map(monthLines.map((l) => [l.id, l]));
  const templateIds = new Set(template.map((t) => t.id));

  const upserts: MonthLine[] = template.map((t) => {
    const existing = byId.get(t.id);
    return {
      id: t.id, name: t.name, amount: t.amount, channel: t.channel, cutoff: t.cutoff,
      order: t.order, oneOff: false,
      status: existing?.status ?? "",
      ...(existing?.paidDate ? { paidDate: existing.paidDate } : {}),
    };
  });

  const deletes = monthLines
    .filter((l) => !l.oneOff && !templateIds.has(l.id))
    .map((l) => l.id);

  return { upserts, deletes };
}
```

- [ ] **Step 8: Run — pass + full suite.** `npx vitest run` → PASS.

- [ ] **Step 9: Commit.**

```bash
git add src/lib/project.ts src/lib/project.test.ts src/lib/reconcile.ts src/lib/reconcile.test.ts
git commit -m "feat(m6): forward-simulation (project.ts) + template reconcile (reconcile.ts) pure fns"
```

---

### Task 2: Paths + repo — month-scoped CRUD, sync, startMonth

**Files:** Modify `src/lib/paths.ts`, `src/lib/repo.ts`.

**Interfaces:**
- Produces: `monthIncomes(key)`; `addMonthLine`, `deleteMonthLine`, `addMonthIncome`, `deleteMonthIncome`, `syncMonthFromTemplate`, `startMonth`.

- [ ] **Step 1: Path helper.** In `src/lib/paths.ts`, after `monthLines`:

```ts
export const monthIncomes = (key: string): string => `${monthDoc(key)}/incomes`;
```

- [ ] **Step 2: Repo helpers.** In `src/lib/repo.ts`, add `getDocs` is already imported; add `monthIncomes`, `templateLines` (already imported), `getDoc` to the firestore import. Update the paths import to include `monthIncomes`. Add `EventItem`, `TemplateLine` already imported. Append:

```ts
/** Add a one-off month line (oneOff:true) to a month. */
export async function addMonthLine(monthKey: string, line: Omit<MonthLine, "id">): Promise<void> {
  await setDoc(doc(collection(db, monthLines(monthKey))), line);
}
export async function deleteMonthLine(monthKey: string, id: string): Promise<void> {
  await deleteDoc(doc(db, monthLines(monthKey), id));
}
/** Add a one-off income to a month's incomes subcollection. */
export async function addMonthIncome(monthKey: string, income: Omit<Income, "id">): Promise<void> {
  await setDoc(doc(collection(db, monthIncomes(monthKey))), income);
}
export async function deleteMonthIncome(monthKey: string, id: string): Promise<void> {
  await deleteDoc(doc(db, monthIncomes(monthKey), id));
}

/** Reconcile a month's template-derived lines to the current template (keeps ticks + one-offs). */
export async function syncMonthFromTemplate(monthKey: string): Promise<void> {
  const [tSnap, mSnap] = await Promise.all([
    getDocs(collection(db, templateLines())),
    getDocs(collection(db, monthLines(monthKey))),
  ]);
  const template = tSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TemplateLine[];
  const lines = mSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MonthLine[];
  const { upserts, deletes } = reconcileLines(template, lines);
  const batch = writeBatch(db);
  for (const l of upserts) {
    const { id, ...rest } = l;
    batch.set(doc(db, monthLines(monthKey), id), rest);
  }
  for (const id of deletes) batch.delete(doc(db, monthLines(monthKey), id));
  await batch.commit();
}

/** Generate a not-yet-existing month for real (used by "Start this month"). */
export async function startMonth(monthKey: string): Promise<void> {
  const metaRef = doc(db, monthDoc(monthKey));
  if ((await getDoc(metaRef)).exists()) return; // idempotent
  const [tSnap, eSnap, iSnap] = await Promise.all([
    getDocs(collection(db, templateLines())),
    getDocs(collection(db, eventsCol())),
    getDocs(collection(db, templateIncomes())),
  ]);
  const template = tSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as TemplateLine[];
  const events = eSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as EventItem[];
  const incomes = iSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Income[];
  await writeMonth(monthKey, generateMonthLines(template, events, monthKey), incomes);
}
```

Add imports at the top of `repo.ts`: `getDoc` to the firestore import; `eventsCol` (already there), `monthIncomes` to the paths import; `reconcileLines` from `./reconcile`; `generateMonthLines` from `./selectors`. `writeMonth` is defined in this file.

- [ ] **Step 3: Typecheck + build.** `npm run typecheck && npm run build` → PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/lib/paths.ts src/lib/repo.ts
git commit -m "feat(m6): month-scoped line/income CRUD, syncMonthFromTemplate, startMonth"
```

---

### Task 3: `MonthProvider` rework — viewed month + modes

**Files:** Rewrite `src/components/MonthProvider.tsx`.

**Interfaces:**
- Produces context: `{ viewedKey, currentKey, mode, editable, lines, incomes, ready, goPrev, goNext, start }` where `mode: "past"|"current"|"projected"|"started"`.

- [ ] **Step 1: Rewrite `MonthProvider.tsx`.**

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { currentMonthKey } from "../lib/clock";
import { addMonths } from "../lib/format";
import {
  eventsCol, monthDoc, monthIncomes, monthLines, templateIncomes, templateLines,
} from "../lib/paths";
import { startMonth, writeMonth } from "../lib/repo";
import { generateMonthLines } from "../lib/selectors";
import type { EventItem, Income, MonthLine, TemplateLine } from "../lib/types";
import { useCollection } from "../hooks/useCollection";
import { useDoc } from "../hooks/useDoc";

export type MonthMode = "past" | "current" | "projected" | "started";

interface MonthCtx {
  viewedKey: string;
  currentKey: string;
  mode: MonthMode;
  editable: boolean;
  lines: MonthLine[];
  incomes: Income[];
  ready: boolean;
  goPrev: () => void;
  goNext: () => void;
  start: () => void;
}
const Ctx = createContext<MonthCtx | null>(null);
export const useMonth = (): MonthCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMonth outside MonthProvider");
  return v;
};

export default function MonthProvider({ children }: { children: React.ReactNode }) {
  const currentKey = currentMonthKey();
  const [viewedKey, setViewedKey] = useState(currentKey);

  const template = useCollection<TemplateLine>(templateLines());
  const templateIncomeList = useCollection<Income>(templateIncomes());
  const events = useCollection<EventItem>(eventsCol());

  const monthMeta = useDoc<{ id: string }>(monthDoc(viewedKey));
  const savedLines = useCollection<MonthLine>(monthLines(viewedKey));
  const monthIncomeList = useCollection<Income>(monthIncomes(viewedKey));

  const loadingMeta = monthMeta === undefined;
  const exists = monthMeta !== null && monthMeta !== undefined;

  const mode: MonthMode =
    viewedKey === currentKey ? "current"
    : viewedKey < currentKey ? "past"
    : exists ? "started"
    : "projected";

  const editable = mode === "current" || mode === "started";
  const isProjected = mode === "projected" || (mode === "past" && !loadingMeta && !exists);

  // Reset the generation guard whenever the viewed month changes.
  const startedRef = useRef(false);
  useEffect(() => { startedRef.current = false; }, [viewedKey]);

  // Auto-generate ONLY the current month when missing.
  useEffect(() => {
    if (
      viewedKey === currentKey && monthMeta === null && !startedRef.current &&
      template.length > 0 && templateIncomeList.length > 0
    ) {
      startedRef.current = true;
      const generated = generateMonthLines(template, events, currentKey);
      void writeMonth(currentKey, generated, templateIncomeList).catch(() => { startedRef.current = false; });
    }
  }, [viewedKey, currentKey, monthMeta, template, events, templateIncomeList]);

  const lines = useMemo<MonthLine[]>(
    () => (isProjected ? generateMonthLines(template, events, viewedKey) : savedLines),
    [isProjected, template, events, viewedKey, savedLines],
  );

  const incomes = useMemo<Income[]>(
    () => [...templateIncomeList, ...monthIncomeList],
    [templateIncomeList, monthIncomeList],
  );

  const ready = isProjected
    ? template.length > 0
    : !loadingMeta && exists && savedLines.length > 0;

  const value: MonthCtx = {
    viewedKey, currentKey, mode, editable, lines, incomes, ready,
    goPrev: () => setViewedKey((k) => addMonths(k, -1)),
    goNext: () => setViewedKey((k) => addMonths(k, 1)),
    start: () => { void startMonth(viewedKey); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
```

- [ ] **Step 2: Typecheck + build.** Will FAIL at `ThisMonth.tsx` (uses `monthKey`); fixed in Task 4. To keep this commit green, temporarily alias in `ThisMonth` — instead, do Task 3 + Task 4 back-to-back and commit together. Skip a standalone build here.

- [ ] **Step 3: Commit (with Task 4).** MonthProvider + ThisMonth ship together — see Task 4's commit.

---

### Task 4: `ThisMonth` — nav header, modes, merged incomes, read-only wiring

**Files:** Modify `src/components/LineRow.tsx`, `src/components/DebtPlan.tsx`, rewrite `src/components/ThisMonth.tsx`.

**Interfaces:**
- Consumes: reworked `useMonth`. `LineRow`/`DebtPlan` gain `readOnly?: boolean`.

- [ ] **Step 1: `LineRow` read-only.** In `src/components/LineRow.tsx`, change the signature and disable the toggle:

```tsx
export default function LineRow({ monthKey, line, readOnly = false }: { monthKey: string; line: MonthLine; readOnly?: boolean }) {
  const ticked = line.status !== "";
  const nextStatus = ticked ? "" : "PAID";
  return (
    <li className="py-2 flex items-center justify-between gap-2">
      <button
        onClick={readOnly ? undefined : () => void setLineStatus(monthKey, line.id, nextStatus)}
        disabled={readOnly}
        className={`flex-1 flex items-center gap-2 text-left ${ticked ? "opacity-50" : ""}`}
        aria-pressed={ticked}
      >
```

(Rest of the component unchanged.)

- [ ] **Step 2: `DebtPlan` read-only.** In `src/components/DebtPlan.tsx`, add `readOnly` to props and guard the tap:

```tsx
export default function DebtPlan({
  freeCash, debts, payments, monthKey, cutoff, unplanned = 0, readOnly = false,
}: {
  freeCash: number; debts: Debt[]; payments: PaymentRec[]; monthKey: string; cutoff: 1 | 2;
  unplanned?: number; readOnly?: boolean;
}) {
```

and on the line `<button>`: `disabled={paid || readOnly}` and `onClick={readOnly ? undefined : () => setPayDebt(...)}`.

- [ ] **Step 3: Rewrite `ThisMonth.tsx`.**

```tsx
import { useState } from "react";
import { monthLabel } from "../lib/clock";
import { peso } from "../lib/format";
import { cutoffSummary, unplannedForCutoff } from "../lib/selectors";
import { projectMonthPlan } from "../lib/project";
import { useCollection } from "../hooks/useCollection";
import { useCollectionGroup } from "../hooks/useCollectionGroup";
import { useDoc } from "../hooks/useDoc";
import { debtsCol, eventsCol, expensesCol, monthDoc, templateLines } from "../lib/paths";
import { deleteMonthIncome, deleteMonthLine, setIncomeReceived, syncMonthFromTemplate } from "../lib/repo";
import type { Debt, EventItem, Income, TemplateLine } from "../lib/types";
import { useMonth } from "./MonthProvider";
import LineRow from "./LineRow";
import DebtPlan, { type PaymentRec } from "./DebtPlan";
import AddOneOff from "./AddOneOff";

export default function ThisMonth() {
  const { viewedKey, currentKey, mode, editable, lines, incomes, ready, goPrev, goNext, start } = useMonth();
  const debts = useCollection<Debt>(debtsCol());
  const payments = useCollectionGroup<PaymentRec>("payments");
  const expenses = useCollection<{ id: string; amount: number; date: string }>(expensesCol());
  const meta = useDoc<{ receivedIncomes?: Record<string, boolean> }>(monthDoc(viewedKey));
  const received = meta?.receivedIncomes ?? {};
  // For projected months the plan is forward-simulated from these globals:
  const template = useCollection<TemplateLine>(templateLines());
  const events = useCollection<EventItem>(eventsCol());
  const [adding, setAdding] = useState(false);

  const projected = mode === "projected";

  const header = (
    <div className="flex items-center justify-between mb-4">
      <button onClick={goPrev} className="text-emerald-700 text-lg px-2">‹</button>
      <div className="text-center">
        <h1 className="text-xl font-bold leading-tight">{monthLabel(viewedKey)}</h1>
        {mode !== "current" && (
          <span className="text-[11px] uppercase tracking-wide text-stone-400">
            {mode === "past" ? "history" : projected ? "projected" : "started early"}
          </span>
        )}
      </div>
      <button onClick={goNext} className="text-emerald-700 text-lg px-2">›</button>
    </div>
  );

  if (!ready) {
    return <main className="p-4">{header}<div className="p-6 text-center text-stone-500">Setting up {monthLabel(viewedKey)}…</div></main>;
  }

  return (
    <main className="p-4">
      {header}

      {projected && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          Projected from your template + this month's events. Nothing here is saved.
          <button onClick={start} className="block mt-2 font-semibold text-emerald-700">Start {monthLabel(viewedKey)} →</button>
        </div>
      )}

      {editable && (
        <div className="flex gap-3 mb-3 text-sm">
          <button onClick={() => setAdding(true)} className="font-semibold text-emerald-700">+ Add one-off</button>
          {mode === "current" && (
            <button onClick={() => void syncMonthFromTemplate(viewedKey)} className="font-semibold text-stone-500">Sync from template</button>
          )}
        </div>
      )}

      {([1, 2] as const).map((cutoff) => {
        const s = cutoffSummary(lines, incomes, cutoff);
        const unplanned = editable ? unplannedForCutoff(expenses, viewedKey, cutoff) : 0;
        const freeCash = Math.max(0, s.surplus - unplanned);
        const pct = s.planned > 0 ? Math.round((s.ticked / s.planned) * 100) : 0;
        const cutLines = lines.filter((l) => l.cutoff === cutoff).sort((a, b) => a.order - b.order);
        const cutIncomes = incomes.filter((i) => i.cutoff === cutoff).sort((a, b) => a.day - b.day);
        const proj = projected ? projectMonthPlan(viewedKey, currentKey, debts, template, events, incomes) : null;
        const projAlloc = proj ? (cutoff === 1 ? proj.alloc.c1 : proj.alloc.c2) : null;

        return (
          <section key={cutoff} className="mb-6 bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold mb-1">{cutoff === 1 ? "1ST CUTOFF" : "2ND CUT-OFF"}</h2>
            {editable && (
              <div className="h-2 rounded-full bg-stone-100 mb-3 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
            )}
            {cutIncomes.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1">
                {cutIncomes.map((i) => {
                  const on = received[i.id] === true;
                  return (
                    <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-emerald-800">↓ {i.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums text-emerald-800">{peso(i.amount)}</span>
                        {editable && (
                          <button
                            onClick={() => void setIncomeReceived(viewedKey, i.id, !on)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${on ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-400"}`}
                          >{on ? "RECEIVED" : "receive"}</button>
                        )}
                        {editable && <button onClick={() => void deleteMonthIncome(viewedKey, i.id)} className="text-stone-300 text-xs">✕</button>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <ul className="divide-y divide-stone-100">
              {cutLines.map((l) => (
                <li key={l.id} className="flex items-center">
                  <div className="flex-1"><LineRow monthKey={viewedKey} line={l} readOnly={!editable} /></div>
                  {editable && l.oneOff && (
                    <button onClick={() => void deleteMonthLine(viewedKey, l.id)} className="text-stone-300 text-xs px-2">✕</button>
                  )}
                </li>
              ))}
            </ul>

            {mode !== "past" && !projected && (
              <DebtPlan freeCash={freeCash} debts={debts} payments={payments} monthKey={viewedKey} cutoff={cutoff} unplanned={unplanned} />
            )}
            {projected && projAlloc && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-500 mb-2">PROJECTED PLAN · free cash {peso(cutoff === 1 ? proj!.free.c1 : proj!.free.c2)}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {projAlloc.lines.map((l) => (
                    <li key={l.debtId} className="flex justify-between">
                      <span className="text-stone-600">{l.name} <span className="text-[10px] text-stone-400">{l.kind}</span></span>
                      <span className="tabular-nums font-semibold">{peso(l.amount)}</span>
                    </li>
                  ))}
                  {projAlloc.lines.length === 0 && <li className="text-xs text-stone-400">No free cash this cutoff.</li>}
                </ul>
              </div>
            )}

            <p className="mt-3 text-sm flex justify-between font-semibold">
              <span>Income {peso(s.income)}</span>
              <span className="text-emerald-700">Surplus {peso(s.surplus)}</span>
            </p>
          </section>
        );
      })}

      {adding && <AddOneOff monthKey={viewedKey} onClose={() => setAdding(false)} />}
    </main>
  );
}
```

- [ ] **Step 4: Create a stub `AddOneOff` so it compiles** (full impl in Task 6). Create `src/components/AddOneOff.tsx`:

```tsx
export default function AddOneOff({ onClose }: { monthKey: string; onClose: () => void }) {
  return null; // replaced in Task 6
  void onClose;
}
```

- [ ] **Step 5: Typecheck + build.** `npm run typecheck && npm run build` → PASS.

- [ ] **Step 6: Commit.**

```bash
git add src/components/MonthProvider.tsx src/components/ThisMonth.tsx src/components/LineRow.tsx src/components/DebtPlan.tsx src/components/AddOneOff.tsx
git commit -m "feat(m6): month nav + past/current/projected/started modes; read-only wiring"
```

---

### Task 5: (folded into Task 4) Projected rendering

Projected lines, the forward-simulated plan, the caveat banner, and the "Start" button are all in Task 4's `ThisMonth`. No separate task — verify in Task 8 that a future month shows the projected plan and Start works.

---

### Task 6: `AddOneOff` dialog (expense + income)

**Files:** Replace `src/components/AddOneOff.tsx`.

**Interfaces:** Consumes `addMonthLine`, `addMonthIncome`, `CHANNELS`.

- [ ] **Step 1: Implement `AddOneOff.tsx`.**

```tsx
import { useState } from "react";
import { CHANNELS } from "../lib/channels";
import { addMonthIncome, addMonthLine } from "../lib/repo";
import type { Channel } from "../lib/types";

export default function AddOneOff({ monthKey, onClose }: { monthKey: string; onClose: () => void }) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<Channel>("CASH");
  const [cutoff, setCutoff] = useState<1 | 2>(2);
  const [day, setDay] = useState("28");
  const amt = Number(amount);
  const valid = name.trim() !== "" && amt > 0;

  async function save() {
    if (!valid) return;
    if (kind === "expense") {
      await addMonthLine(monthKey, { name: name.trim(), amount: amt, channel, cutoff, order: 900, oneOff: true, status: "" });
    } else {
      await addMonthIncome(monthKey, { name: name.trim(), amount: amt, day: Number(day) || 1, cutoff });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold">Add one-off</h3>
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${kind === k ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-500"}`}>
              {k === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="text-sm border-b border-stone-300 outline-none pb-1" />
        <label className="flex items-center justify-between text-sm">Amount
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28 text-right border-b border-stone-300 outline-none tabular-nums" />
        </label>
        <label className="flex items-center justify-between text-sm">Cutoff
          <select value={cutoff} onChange={(e) => setCutoff(Number(e.target.value) as 1 | 2)} className="text-sm border-b border-stone-300 outline-none">
            <option value={1}>1</option><option value={2}>2</option>
          </select>
        </label>
        {kind === "expense" ? (
          <label className="flex items-center justify-between text-sm">Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="text-sm border-b border-stone-300 outline-none">
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ) : (
          <label className="flex items-center justify-between text-sm">Day (1–31)
            <input type="number" value={day} onChange={(e) => setDay(e.target.value)} className="w-20 text-right border-b border-stone-300 outline-none tabular-nums" />
          </label>
        )}
        <div className="flex gap-2 mt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-stone-500 bg-stone-100">Cancel</button>
          <button onClick={() => void save()} disabled={!valid} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 disabled:opacity-40">Add</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build.** `npm run typecheck && npm run build` → PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/components/AddOneOff.tsx
git commit -m "feat(m6): AddOneOff dialog — one-off expense line + one-off income"
```

---

### Task 7: Template reconcile trigger + delete-warns

**Files:** Modify `src/components/settings/TemplateEditor.tsx`.

**Interfaces:** Consumes `syncMonthFromTemplate`, `currentMonthKey`, `useCollection(monthLines(currentMonthKey()))` to detect a PAID counterpart.

- [ ] **Step 1: Sync after save + warn on delete.** In `TemplateEditor.tsx`:

Add imports:

```ts
import { currentMonthKey } from "../../lib/clock";
import { monthLines } from "../../lib/paths";
import { addTemplateLine, updateTemplateLine, deleteTemplateLine, syncMonthFromTemplate } from "../../lib/repo";
import type { Channel, MonthLine, TemplateLine } from "../../lib/types";
```

Subscribe to the current month's lines at the top of `TemplateEditor`:

```ts
  const monthKey = currentMonthKey();
  const monthLineList = useCollection<MonthLine>(monthLines(monthKey));
```

After the list's `Form.onDone` save path, reconcile. Simplest: wrap save in the list component — change `Form`'s `save()` callers so that after `addTemplateLine`/`updateTemplateLine` resolve, the editor calls `syncMonthFromTemplate(monthKey)`. Implement by passing an `afterWrite` callback to `Form`:

```tsx
// in TemplateEditor list render:
if (editing) return <Form line={editing} onDone={async () => { await syncMonthFromTemplate(monthKey); setEditing(null); }} />;
```

And make `Form`'s `save()` await `onDone()`:

```tsx
  async function save() {
    if (!f.name.trim()) return;
    if (id) await updateTemplateLine(id, f); else await addTemplateLine(f);
    await onDone();
  }
```
(Change `Form`'s prop type to `onDone: () => void | Promise<void>`.)

For **delete**, replace the confirm's message + action to warn about the current month and reconcile after:

```tsx
      {confirmId && (() => {
        const counterpart = monthLineList.find((l) => l.id === confirmId && !l.oneOff);
        const paid = counterpart?.status === "PAID";
        return (
          <ConfirmDialog
            title="Delete template line?"
            message={
              counterpart
                ? `This also removes it from ${monthKey}${paid ? " — where it's already marked PAID" : ""}.`
                : "Removed from future months."
            }
            onConfirm={async () => {
              await deleteTemplateLine(confirmId);
              await syncMonthFromTemplate(monthKey);
              setConfirmId(null);
            }}
            onCancel={() => setConfirmId(null)}
          />
        );
      })()}
```

- [ ] **Step 2: Typecheck + build.** `npm run typecheck && npm run build` → PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/components/settings/TemplateEditor.tsx
git commit -m "feat(m6): reconcile current month after template edits; warn on delete"
```

---

### Task 8: Live verification + deploy

- [ ] **Step 1: Full green.** `npm run build && npx vitest run` → both PASS.
- [ ] **Step 2: Boot smoke test** (`npm run dev`, load, 0 new console errors).
- [ ] **Step 3: Signed-in walkthrough** (needs PIN; live or dev):
  1. **Nav:** ‹ › moves months; header shows month + mode badge.
  2. **Future/projected:** page to Aug → "Projected" banner, projected lines incl. events, and a **PROJECTED PLAN** built on lower simulated balances (heavier future months show fewer/ smaller targets). Free cash reflects events.
  3. **Start:** press "Start August" → it becomes editable; balances/plan now interactive.
  4. **One-off:** on July, "+ Add one-off" → add an expense line → appears with ✕; add an income → shows as an income line with RECEIVED + ✕; surplus updates.
  5. **Template reconcile:** edit a template line's amount in Settings → July's matching line updates but a PAID tick survives; delete a template line that's PAID in July → warning names it; confirm → line gone, tick discarded as warned; one-off + event lines untouched.
  6. **Past:** page back a month → read-only (no ticks, no add, no plan pay).
- [ ] **Step 4: Confirm with user, then deploy.**

```bash
git push origin main
```

- [ ] **Step 5: Verify deploy** green + live smoke.

---

## Self-Review

**Spec coverage:** nav modes → Task 3/4 ✓; projection + forward sim → Task 1 (`project.ts`) + Task 4 render ✓; Start this month → Task 2 (`startMonth`) + Task 4 button ✓; one-off expense + income → Task 2 repo + Task 6 dialog ✓; template reconcile preserving ticks/one-offs → Task 1 (`reconcileLines`) + Task 2 (`syncMonthFromTemplate`) + Task 7 trigger ✓; delete-warns → Task 7 ✓; read-only past/projected → Task 4 (`readOnly` on LineRow/DebtPlan, editable gates) ✓; month-scoped incomes → Task 2 (`monthIncomes`, `addMonthIncome`) + Task 3 merge ✓.

**Type consistency:** `useMonth()` now returns `{viewedKey,currentKey,mode,editable,lines,incomes,ready,goPrev,goNext,start}` — `ThisMonth` (only consumer) updated in Task 4; `Debts.tsx`/`Dashboard.tsx` use `currentMonthKey()` directly, unaffected. `reconcileLines`/`projectMonthPlan`/`simulateBalances`/`applyAllocation` signatures identical between definition (Task 1) and use (Tasks 2, 4). `Allocation`/`AllocLine` reused from `allocate.ts`. `readOnly` added to `LineRow` and `DebtPlan` consistently.

**Placeholder scan:** the Task 4 `AddOneOff` stub is intentional scaffolding, replaced in Task 6. No other placeholders — every step has complete code + exact commands.
